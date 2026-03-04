/**
 * API Runner — запуск AI-агента через REST API
 * 
 * Аналог telegram/runner.js, но для внешних API-запросов.
 * Запускает агентский цикл и обновляет статус задачи в store.
 */

const manageStore = require('../store');
const sessionService = require('../../services/session.service');
const contextHelper = require('../telegram/context');
const planService = require('../../services/plan.service');
const { TOOLS_TERMINAL } = require('../telegram/tools');
const { executeAgentLoop } = require('../telegram/agentLoop');
const { getSystemInstruction } = require('../prompts');
const { enqueue } = require('../agentQueue');

/**
 * Запускает выполнение API-задачи
 * 
 * @param {string} chatId - ID сессии
 * @param {string} taskId - ID задачи
 * @returns {Promise<void>}
 */
async function runApiTask(chatId, taskId) {
    const task = manageStore.getApiTask(chatId, taskId);
    if (!task) {
        console.error(`[API-RUNNER] Task ${taskId} not found`);
        return;
    }

    // Обновляем статус на running
    manageStore.updateApiTask(chatId, taskId, {
        status: 'running',
        startedAt: Date.now()
    });

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[API-RUNNER] ▶ START  chatId=${chatId}  taskId=${taskId}`);
    console.log(`[API-RUNNER]   task: ${task.task.slice(0, 100)}...`);
    console.log(`${'═'.repeat(60)}`);

    try {
        // Получаем данные сессии
        const data = manageStore.getState(chatId);
        if (!data || !data.aiAuthToken || !data.aiModel) {
            throw new Error('AI not configured for this chatId');
        }

        // Проверяем сессию
        const session = sessionService.getSession(chatId);
        if (!session) {
            throw new Error('Session not found. Create session first.');
        }

        // Проверяем баланс
        if (data.aiBlocked) {
            throw new Error(data.aiBlockReason || 'AI is blocked due to balance issues');
        }

        // Формируем системный промпт
        const structuredContext = await contextHelper.buildFullContextStructured(chatId);
        const systemPrompt = getSystemInstruction('TERMINAL', structuredContext, 'api');

        // Формируем сообщение пользователя
        let userMessage = task.task;
        if (task.projectName) {
            userMessage = `[Проект: ${task.projectName}]\n\n${task.task}`;
        }

        // История сообщений (для API-задач начинаем с чистого листа)
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];

        // Токены
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let totalTokens = 0;

        // Текущие шаги плана
        let currentSteps = [];
        let currentPlanId = null;

        // Контекст агента
        const agentCtx = {
            channel: 'api',
            chatId,
            
            // Не используется для API, но нужен для совместимости
            sendMessage: async (msg) => {
                console.log(`[API-RUNNER] Message: ${msg.slice(0, 100)}...`);
            },
            
            // Установка шагов плана
            setSteps: async (steps) => {
                currentSteps = steps.map(s => ({ text: s, status: 'pending' }));
                manageStore.updateApiTask(chatId, taskId, { steps: currentSteps });
            },
            
            // Отметить шаг выполненным
            markStepDone: async () => {
                const idx = currentSteps.findIndex(s => s.status === 'in_progress');
                if (idx >= 0) {
                    currentSteps[idx].status = 'done';
                }
                // Находим следующий pending и делаем in_progress
                const nextIdx = currentSteps.findIndex(s => s.status === 'pending');
                if (nextIdx >= 0) {
                    currentSteps[nextIdx].status = 'in_progress';
                }
                manageStore.updateApiTask(chatId, taskId, { steps: currentSteps });
            },
            
            // Обновить статус-сообщение
            updateStatusMessage: async (msg) => {
                // Для API не нужно, но может использоваться для логирования
            },
            
            // Отправить HTML (не используется для API)
            sendHtmlMessage: async (html) => {},
            
            // Отправить файл (не используется для API)
            sendFile: async (path, caption) => {},
            
            // Обновить токены
            updateTokens: async (prompt, completion, total) => {
                totalPromptTokens = prompt;
                totalCompletionTokens = completion;
                totalTokens = total;
                manageStore.updateApiTask(chatId, taskId, {
                    usage: {
                        prompt_tokens: totalPromptTokens,
                        completion_tokens: totalCompletionTokens,
                        total_tokens: totalTokens
                    }
                });
            },
            
            // Подтверждение (для API всегда подтверждаем)
            confirm: async (question) => {
                return true;
            }
        };

        // Запускаем агентский цикл
        const result = await enqueue(chatId, () => executeAgentLoop(
            chatId,
            data,
            messages,
            TOOLS_TERMINAL,
            agentCtx,
            30 // больше итераций для API-задач
        ));

        // Если агент создал план — парсим его шаги
        if (result && !result.error) {
            try {
                const plans = await planService.listActivePlans(chatId);
                if (plans.length > 0) {
                    // Берём самый свежий план
                    const latestPlan = plans.sort((a, b) => b.id - a.id)[0];
                    const planContent = await planService.readPlan(chatId, latestPlan.id);
                    currentSteps = planService.parsePlanSteps(planContent);
                    currentPlanId = latestPlan.id;
                }
            } catch (e) {
                console.error('[API-RUNNER] Error parsing plan steps:', e.message);
            }
        }

        // Обновляем задачу по результату
        if (result.error) {
            manageStore.updateApiTask(chatId, taskId, {
                status: 'failed',
                error: result.error,
                completedAt: Date.now(),
                steps: currentSteps,
                usage: {
                    prompt_tokens: totalPromptTokens,
                    completion_tokens: totalCompletionTokens,
                    total_tokens: totalTokens
                }
            });
            console.log(`[API-RUNNER] ✗ FAILED  taskId=${taskId}  error=${result.error}`);
        } else if (result.limitReached) {
            // Лимит достигнут — помечаем как failed с особым флагом
            manageStore.updateApiTask(chatId, taskId, {
                status: 'failed',
                error: 'Max iterations reached. Task may be partially completed.',
                summary: result.summary,
                steps: currentSteps,
                usage: {
                    prompt_tokens: totalPromptTokens,
                    completion_tokens: totalCompletionTokens,
                    total_tokens: totalTokens
                },
                completedAt: Date.now()
            });
            console.log(`[API-RUNNER] ⚠ LIMIT REACHED  taskId=${taskId}`);
        } else {
            // Успешное завершение
            manageStore.updateApiTask(chatId, taskId, {
                status: 'completed',
                summary: result.summary || 'Task completed',
                htmlReport: result.html_report || null,
                filesToSend: result.filesToSend || [],
                steps: currentSteps,
                planId: currentPlanId,
                usage: {
                    prompt_tokens: totalPromptTokens,
                    completion_tokens: totalCompletionTokens,
                    total_tokens: totalTokens
                },
                completedAt: Date.now()
            });
            console.log(`[API-RUNNER] ✓ COMPLETED  taskId=${taskId}  tokens=${totalTokens}`);
        }

    } catch (err) {
        console.error(`[API-RUNNER] ✗ ERROR  taskId=${taskId}:`, err.message);
        manageStore.updateApiTask(chatId, taskId, {
            status: 'failed',
            error: err.message,
            completedAt: Date.now()
        });
    }
}

/**
 * Запускает задачу в фоне (не блокирует ответ API)
 */
function startApiTaskInBackground(chatId, taskId) {
    setImmediate(() => {
        runApiTask(chatId, taskId).catch(err => {
            console.error(`[API-RUNNER] Unhandled error for task ${taskId}:`, err);
        });
    });
}

module.exports = {
    runApiTask,
    startApiTaskInBackground
};
