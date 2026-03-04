/**
 * API Routes для запуска AI-агента через REST API
 * 
 * POST /:chatId/agent/task - создать задачу
 * GET /:chatId/agent/task/:taskId - получить статус задачи
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const manageStore = require('./store');
const { startApiTaskInBackground } = require('./agent/apiRunner');

/**
 * POST /:chatId/agent/task
 * 
 * Создаёт новую задачу для AI-агента
 * 
 * Body:
 *   - user_id: string (опционально) - ID пользователя
 *   - project_name: string (опционально) - имя проекта
 *   - task: string (обязательно) - описание задачи
 * 
 * Response:
 *   - taskId: string - ID созданной задачи
 *   - status: string - начальный статус ('queued')
 */
router.post('/agent/task', async (req, res) => {
    const { chatId } = req.params;
    const { user_id, project_name, task } = req.body;
    
    if (!chatId) {
        return res.status(400).json({ error: 'chatId is required (use /api/:chatId/agent/task)' });
    }
    
    if (!task || typeof task !== 'string' || task.trim().length === 0) {
        return res.status(400).json({ error: 'task is required and must be non-empty string' });
    }
    
    // Проверяем что chatId существует и настроен
    const data = manageStore.getState(chatId);
    if (!data) {
        return res.status(404).json({ error: 'chatId not found. Create session first.' });
    }
    
    if (!data.aiAuthToken || !data.aiModel) {
        return res.status(400).json({ error: 'AI not configured for this chatId' });
    }
    
    if (data.aiBlocked) {
        return res.status(403).json({ 
            error: 'AI is blocked', 
            reason: data.aiBlockReason || 'Balance issues' 
        });
    }
    
    try {
        // Создаём задачу
        const taskId = manageStore.createApiTask(chatId, {
            user_id: user_id || null,
            project_name: project_name || null,
            task: task.trim()
        });
        
        console.log(`[API-ROUTES] Task created: chatId=${chatId} taskId=${taskId}`);
        
        // Запускаем в фоне
        startApiTaskInBackground(chatId, taskId);
        
        res.json({
            taskId,
            status: 'queued',
            message: 'Task queued for execution'
        });
        
    } catch (err) {
        console.error('[API-ROUTES] Error creating task:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:chatId/agent/task/:taskId
 * 
 * Получает статус задачи
 * 
 * Response:
 *   - id: string
 *   - status: 'queued' | 'running' | 'completed' | 'failed'
 *   - steps: [{text, status}]
 *   - summary: string (если completed)
 *   - error: string (если failed)
 *   - usage: {prompt_tokens, completion_tokens, total_tokens}
 *   - createdAt: timestamp
 *   - startedAt: timestamp
 *   - completedAt: timestamp
 */
router.get('/agent/task/:taskId', (req, res) => {
    const { chatId, taskId } = req.params;
    
    if (!chatId || !taskId) {
        return res.status(400).json({ error: 'chatId and taskId are required' });
    }
    
    const task = manageStore.getApiTask(chatId, taskId);
    
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    // Возвращаем полную информацию о задаче
    res.json({
        id: task.id,
        chatId: task.chatId,
        userId: task.userId,
        projectName: task.projectName,
        task: task.task,
        status: task.status,
        steps: task.steps || [],
        summary: task.summary || null,
        htmlReport: task.htmlReport || null,
        filesToSend: task.filesToSend || [],
        planId: task.planId || null,
        usage: task.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        },
        error: task.error || null,
        createdAt: task.createdAt,
        startedAt: task.startedAt || null,
        completedAt: task.completedAt || null
    });
});

/**
 * GET /:chatId/agent/tasks
 * 
 * Получает список всех задач для chatId
 */
router.get('/agent/tasks', (req, res) => {
    const { chatId } = req.params;
    
    if (!chatId) {
        return res.status(400).json({ error: 'chatId is required' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const tasks = manageStore.getApiTasks(chatId, limit);
    
    res.json({
        chatId,
        count: tasks.length,
        tasks: tasks.map(t => ({
            id: t.id,
            status: t.status,
            task: t.task.slice(0, 100),
            stepsCount: (t.steps || []).length,
            totalTokens: (t.usage || {}).total_tokens || 0,
            createdAt: t.createdAt,
            completedAt: t.completedAt
        }))
    });
});

/**
 * DELETE /:chatId/agent/task/:taskId
 * 
 * Удаляет завершённую задачу
 */
router.delete('/agent/task/:taskId', (req, res) => {
    const { chatId, taskId } = req.params;
    
    if (!chatId || !taskId) {
        return res.status(400).json({ error: 'chatId and taskId are required' });
    }
    
    const task = manageStore.getApiTask(chatId, taskId);
    
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    // Можно удалять только завершённые задачи
    if (task.status === 'running') {
        return res.status(400).json({ error: 'Cannot delete running task' });
    }
    
    // Удаляем из store
    manageStore.updateApiTask(chatId, taskId, { _deleted: true });
    
    res.json({ success: true, message: 'Task deleted' });
});

module.exports = router;
