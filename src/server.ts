import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db';
import fs from 'node:fs';

const JWT_SECRET = process.env['JWT_SECRET'] || 'voxreport-super-secret';

const browserDistFolder = join(process.cwd(), 'dist/app/browser');
const uploadDir = join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  }
});

const angularApp = new AngularNodeAppEngine();

app.use(express.json());

interface User {
  id: number | bigint;
  email: string;
  name: string;
  role: string;
  password?: string;
}

interface AuthRequest extends express.Request {
  user?: User;
}

// --- Auth Middleware ---
const authenticate = (req: AuthRequest, res: express.Response, next: express.NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const info = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hashedPassword, name);
    const token = jwt.sign({ id: info.lastInsertRowid, email, name, role: 'user' }, JWT_SECRET);
    res.json({ token, user: { id: info.lastInsertRowid, email, name, role: 'user' } });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  if (user && user.password && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Reports
app.get('/api/reports', authenticate, (req: AuthRequest, res: express.Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const showArchived = req.query['archived'] === 'true';
  const reports = db.prepare('SELECT * FROM reports WHERE userId = ? AND isArchived = ? ORDER BY createdAt DESC')
    .all(req.user.id, showArchived ? 1 : 0);
  res.json(reports);
});

app.get('/api/reports/:id', authenticate, (req: AuthRequest, res: express.Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const reportId = Number(req.params['id']);
  if (isNaN(reportId)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND userId = ?').get(reportId, req.user.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json(report);
});

app.patch('/api/reports/:id', authenticate, (req: AuthRequest, res: express.Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const reportId = Number(req.params['id']);
  if (isNaN(reportId)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }
  const { status, summary, progress, error, isArchived } = req.body;
  
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND userId = ?').get(reportId, req.user.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (status !== undefined) {
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, reportId);
  }
  if (summary !== undefined) {
    db.prepare('UPDATE reports SET summary = ? WHERE id = ?').run(summary, reportId);
  }
  if (progress !== undefined) {
    db.prepare('UPDATE reports SET progress = ? WHERE id = ?').run(progress, reportId);
  }
  if (isArchived !== undefined) {
    db.prepare('UPDATE reports SET isArchived = ? WHERE id = ?').run(isArchived ? 1 : 0, reportId);
  }
  
  io.emit(`report:${reportId}:status`, { status, progress, error, isArchived });
  
  res.json({ success: true });
});

app.delete('/api/reports/:id', authenticate, (req: AuthRequest, res: express.Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const reportId = Number(req.params['id']);
  if (isNaN(reportId)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }
  console.log(`Tentative de suppression du rapport ${reportId} par l'utilisateur ${req.user.id}`);
  
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND userId = ?').get(reportId, req.user.id) as { filePath?: string } | undefined;
  
  if (!report) {
    console.log(`Rapport ${reportId} non trouvé pour l'utilisateur ${req.user.id}`);
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  try {
    const result = db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
    console.log(`Résultat de la suppression DB: ${result.changes} ligne(s) supprimée(s)`);
    
    if (report.filePath) {
      const fullPath = join(process.cwd(), report.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Fichier supprimé: ${fullPath}`);
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur lors de la suppression:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/reports/:id/file', authenticate, (req: AuthRequest, res: express.Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const reportId = Number(req.params['id']);
  if (isNaN(reportId)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND userId = ?').get(reportId, req.user.id) as { filePath?: string } | undefined;
  if (!report || !report.filePath) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  const fullPath = join(process.cwd(), report.filePath);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File does not exist on disk' });
    return;
  }
  res.sendFile(fullPath);
});

// Upload & Process
const upload = multer({ dest: 'uploads/' });
app.post('/api/reports/upload', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file || !req.user) {
    res.status(400).json({ error: 'No file uploaded or unauthorized' });
    return;
  }

  const { title } = req.body;
  const info = db.prepare('INSERT INTO reports (userId, title, originalFileName, filePath, status) VALUES (?, ?, ?, ?, ?)').run(
    req.user.id, title || req.file.originalname, req.file.originalname, req.file.path, 'processing'
  );
  const reportId = info.lastInsertRowid;

  res.json({ id: reportId, status: 'processing' });
});

// --- Angular Handling ---
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  httpServer.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
