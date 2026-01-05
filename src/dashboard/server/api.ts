import { Router } from 'express';
import { getRegistryPoints, getProject } from '../../utils/system.js';
import { createProject, deleteProject, moveProject } from '../../core/projects.js';
import { log } from '../../utils/logger.js';
import { configureNginx } from '../../core/nginx.js';

export const apiRouter = Router();

// GET /api/projects
apiRouter.get('/projects', async (req, res) => {
    try {
        const registry = await getRegistryPoints();
        const projects: any[] = [];
        for (const [name, data] of Object.entries(registry)) {
            // Retrieve dynamic status (running?)
            // For now just return registry data
            projects.push({ name, ...(data as any) });
        }
        res.json(projects);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/projects
apiRouter.post('/projects', async (req, res) => {
    const { name, template } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        // Run long running task
        // We might want to run this async and notify via socket?
        // For simplicity, wait.
        await createProject(name, template || 'nextjs');
        res.json({ success: true, message: `Project ${name} created` });
    } catch (e: any) {
        log.error(e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/projects/:name
apiRouter.delete('/projects/:name', async (req, res) => {
    const { name } = req.params;
    try {
        await deleteProject(name);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
