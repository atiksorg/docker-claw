document.addEventListener('DOMContentLoaded', () => {
    const tasksDiv = document.getElementById('tasks');
    const CHAT_ID = 'lp'; // Замените на ваш chat_id или получите его динамически

    async function pollTasks() {
        // В реальном приложении вам нужно будет получить список ID задач
        // Здесь для примера мы будем хранить их в localStorage
        const taskIds = JSON.parse(localStorage.getItem('agent_tasks') || '[]');

        if (taskIds.length === 0) {
            tasksDiv.innerHTML = '<p>No tasks found. Submit a task via the API.</p>';
            return;
        }

        tasksDiv.innerHTML = ''; // Очищаем перед обновлением

        for (const taskId of taskIds) {
            try {
                const response = await fetch(`/manage/${CHAT_ID}/agent/task/${taskId}`);
                if (!response.ok) {
                    console.error(`Error fetching task ${taskId}: ${response.status}`);
                    continue;
                }
                const result = await response.json();
                
                const taskEl = document.createElement('div');
                taskEl.className = 'task-card';

                let stepsHtml = '';
                if (result.steps && result.steps.length > 0) {
                    stepsHtml = '<ul>' + result.steps.map(step => {
                        const icon = { 'done': '✅', 'in_progress': '⏳', 'pending': '⬜' }[step.status] || '⬜';
                        return `<li>${icon} ${step.text}</li>`;
                    }).join('') + '</ul>';
                }

                taskEl.innerHTML = `
                    <h3>Task ID: ${result.taskId}</h3>
                    <p><strong>Status:</strong> ${result.status}</p>
                    <p><strong>Project:</strong> ${result.project_name}</p>
                    <p><strong>Task:</strong> ${result.task}</p>
                    <p><strong>Tokens:</strong> ${result.usage.total_tokens.toLocaleString()}</p>
                    <div><strong>Steps:</strong></div>
                    ${stepsHtml}
                    ${result.summary ? `<p><strong>Summary:</strong> ${result.summary}</p>` : ''}
                `;
                tasksDiv.appendChild(taskEl);

            } catch (error) {
                console.error(`Error polling task ${taskId}:`, error);
            }
        }
    }

    // Для демонстрации, давайте добавим фейковый ID задачи, 
    // как будто он был создан через API
    // В реальном сценарии, ваш Python скрипт создаст задачу,
    // а этот UI просто будет ее отображать.
    // Мы не можем напрямую общаться между клиентом и сервером для добавления ID,
    // поэтому используем этот хак для демонстрации.
    
    // Пример того, как можно было бы добавить ID после успешного POST запроса
    // (этот код здесь не выполнится, он для примера)
    /*
    async function submitNewTask() {
        const response = await fetch(`/manage/lp/agent/task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: 'your_user_id', 
                project_name: 'Test Project', 
                task: 'Build a simple website' 
            })
        });
        const data = await response.json();
        const taskIds = JSON.parse(localStorage.getItem('agent_tasks') || '[]');
        taskIds.push(data.taskId);
        localStorage.setItem('agent_tasks', JSON.stringify(taskIds));
    }
    */

    setInterval(pollTasks, 3000); // Опрашивать каждые 3 секунды
    pollTasks(); // Первый вызов
});
