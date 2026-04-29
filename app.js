document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const testSelector = document.getElementById('testSelector');
    const loadTestButton = document.getElementById('loadTestButton');
    const viewHistoryButton = document.getElementById('viewHistoryButton');
    const difficultQuestionsBtn = document.getElementById('difficultQuestionsBtn');
    const statsBtn = document.getElementById('statsBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importDataInput = document.getElementById('importDataInput');
    const clearHistoryButton = document.getElementById('clearHistoryButton');
    
    const testContainer = document.getElementById('test-container');
    const resultsArea = document.getElementById('results-area');
    const difficultQuestionsArea = document.getElementById('difficult-questions-area');
    const statsArea = document.getElementById('stats-area');
    const chartArea = document.getElementById('chart-area');
    const resultsChartCanvas = document.getElementById('resultsChart');
    let resultsChartInstance = null;

    // Pagination Elements
    const paginationControls = document.getElementById('pagination-controls');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitTestBtn = document.getElementById('submitTestBtn');
    const questionCounter = document.getElementById('questionCounter');

    // Timer Elements
    const enableTimerCheckbox = document.getElementById('enableTimer');
    const timerMinutesInput = document.getElementById('timerMinutes');
    const timerDisplay = document.getElementById('timer-display');
    const timeRemainingSpan = document.getElementById('timeRemaining');

    // State Variables
    let currentTestFile = '';
    let testData = null;
    let currentQuestionIndex = 0;
    let userAnswers = []; // userAnswers[index] = 'A'
    let userMarks = [];   // userMarks[index] = 'blue', 'yellow', 'red'
    let timerInterval = null;
    let timeRemainingSeconds = 0;

    // Inicializar: Fetch list of tests from API
    fetch('/api/tests')
        .then(res => res.json())
        .then(tests => {
            testSelector.innerHTML = '';
            tests.forEach(test => {
                const option = document.createElement('option');
                option.value = test;
                const name = test.replace('.json', '');
                option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
                testSelector.appendChild(option);
            });
        })
        .catch(err => {
            console.error('Error fetching tests:', err);
            testSelector.innerHTML = '<option value="">Error cargando tests</option>';
            for(let i=1; i<=26; i++) {
                const opt = document.createElement('option');
                opt.value = `test${i}.json`;
                opt.textContent = `Test ${i}`;
                testSelector.appendChild(opt);
            }
        });

    // Events
    loadTestButton.addEventListener('click', () => {
        const selectedTest = testSelector.value;
        if(selectedTest) {
            startTest(selectedTest);
        }
    });

    viewHistoryButton.addEventListener('click', renderHistory);
    difficultQuestionsBtn.addEventListener('click', renderDifficultQuestions);
    statsBtn.addEventListener('click', renderStats);
    exportDataBtn.addEventListener('click', exportData);
    importDataBtn.addEventListener('click', () => importDataInput.click());
    importDataInput.addEventListener('change', importData);
    clearHistoryButton.addEventListener('click', clearHistory);

    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            saveProgress();
            currentQuestionIndex--;
            renderCurrentQuestion();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < testData.questions.length - 1) {
            saveProgress();
            currentQuestionIndex++;
            renderCurrentQuestion();
        }
    });

    submitTestBtn.addEventListener('click', () => {
        finishTest();
    });

    // Functions
    function hideAllAreas() {
        testContainer.innerHTML = '';
        resultsArea.innerHTML = '';
        difficultQuestionsArea.style.display = 'none';
        statsArea.style.display = 'none';
        chartArea.style.display = 'none';
        paginationControls.style.display = 'none';
        timerDisplay.style.display = 'none';
    }

    function startTest(testFile) {
        currentTestFile = testFile;
        clearInterval(timerInterval);
        hideAllAreas();
        
        fetch(`tests/${testFile}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data.questions || !Array.isArray(data.questions)) {
                    throw new Error('El archivo no tiene el formato esperado.');
                }
                testData = data;
                
                // Intentar cargar progreso guardado
                const savedProgress = JSON.parse(localStorage.getItem('testTcaeProgress')) || {};
                
                if (savedProgress[testFile]) {
                    const state = savedProgress[testFile];
                    userAnswers = state.userAnswers || new Array(data.questions.length).fill(null);
                    userMarks = state.userMarks || new Array(data.questions.length).fill(null);
                    currentQuestionIndex = state.currentQuestionIndex || 0;
                    timeRemainingSeconds = state.timeRemainingSeconds || (parseInt(timerMinutesInput.value) * 60);
                    
                    // Avisar al usuario visualmente
                    alert(`¡Progreso restaurado! Continuas en la pregunta ${currentQuestionIndex + 1}.`);
                } else {
                    userAnswers = new Array(data.questions.length).fill(null);
                    userMarks = new Array(data.questions.length).fill(null);
                    currentQuestionIndex = 0;
                    timeRemainingSeconds = parseInt(timerMinutesInput.value) * 60;
                }
                
                setupTimer(savedProgress[testFile] ? true : false);
                renderCurrentQuestion();
                paginationControls.style.display = 'flex';
                document.getElementById('controls-section').style.display = 'none';
            })
            .catch(error => {
                console.error(error);
                testContainer.innerHTML = `<p style="color:var(--color-danger)">Error: ${error.message}</p>`;
            });
    }

    function saveProgress() {
        if (!currentTestFile) return;
        const savedProgress = JSON.parse(localStorage.getItem('testTcaeProgress')) || {};
        savedProgress[currentTestFile] = {
            currentQuestionIndex,
            userAnswers,
            userMarks,
            timeRemainingSeconds
        };
        localStorage.setItem('testTcaeProgress', JSON.stringify(savedProgress));
    }
    
    function clearProgress() {
        if (!currentTestFile) return;
        const savedProgress = JSON.parse(localStorage.getItem('testTcaeProgress')) || {};
        delete savedProgress[currentTestFile];
        localStorage.setItem('testTcaeProgress', JSON.stringify(savedProgress));
    }

    function saveDifficultQuestion(questionObj, mark) {
        // mark es 'yellow' o 'red'
        if (mark !== 'yellow' && mark !== 'red') return;
        
        let difficultQs = JSON.parse(localStorage.getItem('testTcaeDifficult')) || [];
        
        // Check if already exists, update it or add new
        const existingIdx = difficultQs.findIndex(q => q.test === currentTestFile && q.qIndex === currentQuestionIndex);
        
        const qData = {
            test: currentTestFile,
            qIndex: currentQuestionIndex,
            questionText: questionObj.question,
            correctAnswer: questionObj.correctAnswer,
            options: questionObj.options,
            mark: mark,
            date: new Date().toLocaleDateString()
        };

        if (existingIdx >= 0) {
            difficultQs[existingIdx] = qData;
        } else {
            difficultQs.push(qData);
        }
        
        localStorage.setItem('testTcaeDifficult', JSON.stringify(difficultQs));
    }

    function removeDifficultQuestion(testFile, qIndex) {
        let difficultQs = JSON.parse(localStorage.getItem('testTcaeDifficult')) || [];
        difficultQs = difficultQs.filter(q => !(q.test === testFile && q.qIndex === qIndex));
        localStorage.setItem('testTcaeDifficult', JSON.stringify(difficultQs));
    }

    function setupTimer(isResumed) {
        if (enableTimerCheckbox.checked) {
            timerDisplay.style.display = 'block';
            if (!isResumed) {
                const minutes = parseInt(timerMinutesInput.value) || 30;
                timeRemainingSeconds = minutes * 60;
            }
            updateTimerDisplay();

            timerInterval = setInterval(() => {
                timeRemainingSeconds--;
                updateTimerDisplay();
                
                // Guardar timer de vez en cuando (ej. cada 5 seg)
                if (timeRemainingSeconds % 5 === 0) saveProgress();

                if (timeRemainingSeconds <= 0) {
                    clearInterval(timerInterval);
                    alert('¡Tiempo agotado! Se enviará tu examen ahora.');
                    finishTest();
                }
            }, 1000);
        } else {
            timerDisplay.style.display = 'none';
        }
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeRemainingSeconds / 60).toString().padStart(2, '0');
        const s = (timeRemainingSeconds % 60).toString().padStart(2, '0');
        timeRemainingSpan.textContent = `${m}:${s}`;
        
        if (timeRemainingSeconds < 60) {
            timeRemainingSpan.style.color = 'var(--color-danger)';
        } else {
            timeRemainingSpan.style.color = 'var(--color-primary)';
        }
    }

    function renderCurrentQuestion() {
        testContainer.innerHTML = '';
        const question = testData.questions[currentQuestionIndex];
        const hasAnswered = userAnswers[currentQuestionIndex] !== null;
        const hasMarked = userMarks[currentQuestionIndex] !== null;
        
        const card = document.createElement('div');
        card.className = 'question-card';
        
        let optionsHtml = '';
        question.options.forEach((option) => {
            const optionIdentifier = option.split(')')[0].trim();
            const isChecked = userAnswers[currentQuestionIndex] === optionIdentifier ? 'checked' : '';
            
            let extraClass = '';
            if (hasAnswered) {
                if (optionIdentifier === question.correctAnswer) {
                    extraClass = 'option-correct';
                } else if (optionIdentifier === userAnswers[currentQuestionIndex]) {
                    extraClass = 'option-incorrect';
                }
            }
            
            optionsHtml += `
            <li>
                <label class="${extraClass}">
                    <input type="radio" name="q${currentQuestionIndex}" value="${optionIdentifier}" ${isChecked} ${hasAnswered ? 'disabled' : ''}>
                    ${option}
                </label>
            </li>
            `;
        });

        let explanationHtml = '';
        if (hasAnswered && question.explicacion) {
            explanationHtml = `<div class="correct-answer-text"><strong>Explicación:</strong> ${question.explicacion}</div>`;
        } else if (hasAnswered && userAnswers[currentQuestionIndex] !== question.correctAnswer) {
            explanationHtml = `<div class="correct-answer-text">La respuesta correcta es la <strong>${question.correctAnswer}</strong>.</div>`;
        } else if (hasAnswered && userAnswers[currentQuestionIndex] === question.correctAnswer) {
            explanationHtml = `<div class="correct-answer-text" style="background-color: rgba(40, 167, 69, 0.1); border-left-color: var(--color-success); color: var(--color-success);">¡Correcto!</div>`;
        }

        card.innerHTML = `
            <p>${currentQuestionIndex + 1}. ${question.question}</p>
            
            <button id="showOptionsBtn" class="show-options-btn" style="${hasAnswered ? 'display:none;' : 'display:block; width:100%; padding:1rem; cursor:pointer;'}">
                Mostrar opciones
            </button>

            <ul id="optionsList" class="options-list ${hasAnswered ? 'visible answered' : ''}" style="${hasAnswered ? 'display:block;' : 'display:none;'}">
                ${optionsHtml}
            </ul>
            
            <div id="explanationArea">${explanationHtml}</div>

            <div id="selfAssessment" class="self-assessment-container ${hasAnswered ? 'visible' : ''}">
                <p>¿Cómo te sabías esta pregunta?</p>
                <div class="assessment-buttons">
                    <button class="eval-btn eval-blue ${userMarks[currentQuestionIndex] === 'blue' ? 'selected' : ''}" data-mark="blue">Lo sabía bien</button>
                    <button class="eval-btn eval-yellow ${userMarks[currentQuestionIndex] === 'yellow' ? 'selected' : ''}" data-mark="yellow">Dudé / Detalles</button>
                    <button class="eval-btn eval-red ${userMarks[currentQuestionIndex] === 'red' ? 'selected' : ''}" data-mark="red">No lo sabía</button>
                </div>
            </div>
        `;
        
        testContainer.appendChild(card);
        
        const showOptionsBtn = card.querySelector('#showOptionsBtn');
        const optionsList = card.querySelector('#optionsList');
        const explanationArea = card.querySelector('#explanationArea');
        const selfAssessment = card.querySelector('#selfAssessment');
        const radios = card.querySelectorAll('input[type="radio"]');
        const evalBtns = card.querySelectorAll('.eval-btn');

        if (showOptionsBtn) {
            showOptionsBtn.addEventListener('click', () => {
                showOptionsBtn.style.display = 'none';
                optionsList.style.display = 'block';
                optionsList.classList.add('visible');
            });
        }

        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                userAnswers[currentQuestionIndex] = e.target.value;
                optionsList.classList.add('answered');
                
                // Deshabilitar todos los radios tras responder
                radios.forEach(r => r.disabled = true);
                
                // Mostrar corrección inmediata
                renderCurrentQuestion(); // Re-render para aplicar clases CSS
                saveProgress();
            });
        });

        evalBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mark = e.target.getAttribute('data-mark');
                userMarks[currentQuestionIndex] = mark;
                
                if (mark === 'red' || mark === 'yellow') {
                    saveDifficultQuestion(question, mark);
                } else if (mark === 'blue') {
                    removeDifficultQuestion(currentTestFile, currentQuestionIndex);
                }
                
                saveProgress();
                renderCurrentQuestion(); // Update selected button visual state
            });
        });

        // Actualizar botones de paginación
        questionCounter.textContent = `Pregunta ${currentQuestionIndex + 1} de ${testData.questions.length}`;
        prevBtn.style.visibility = currentQuestionIndex === 0 ? 'hidden' : 'visible';
        
        // Solo habilitar "Siguiente" o "Finalizar" si ha evaluado la pregunta
        const canAdvance = hasAnswered && hasMarked;
        
        if (currentQuestionIndex === testData.questions.length - 1) {
            nextBtn.style.display = 'none';
            submitTestBtn.style.display = 'inline-block';
            submitTestBtn.disabled = !canAdvance;
            submitTestBtn.style.opacity = canAdvance ? '1' : '0.5';
            submitTestBtn.style.cursor = canAdvance ? 'pointer' : 'not-allowed';
        } else {
            nextBtn.style.display = 'inline-block';
            submitTestBtn.style.display = 'none';
            nextBtn.disabled = !canAdvance;
            nextBtn.style.opacity = canAdvance ? '1' : '0.5';
            nextBtn.style.cursor = canAdvance ? 'pointer' : 'not-allowed';
        }
    }

    function finishTest() {
        clearInterval(timerInterval);
        hideAllAreas();
        document.getElementById('controls-section').style.display = 'flex';

        const results = [];
        testData.questions.forEach((q, idx) => {
            const isCorrect = userAnswers[idx] === q.correctAnswer;
            results.push({
                isCorrect: isCorrect,
                userAns: userAnswers[idx],
                correctAns: q.correctAnswer
            });
        });

        const correctCount = results.filter(r => r.isCorrect).length;
        const total = testData.questions.length;
        const percentage = ((correctCount / total) * 100).toFixed(2);
        const nota = ((correctCount / total) * 10).toFixed(2);

        resultsArea.innerHTML = `
            <div class="results-message">
                <h2>Test Completado</h2>
                <div class="score">${nota} / 10</div>
                <p>Aciertos: ${correctCount} de ${total} (${percentage}%)</p>
                <div style="margin-top: 1rem;">
                    <button id="showCorrectionBtn">Ver Corrección</button>
                </div>
            </div>
        `;

        saveHistory(correctCount, total, percentage, nota);
        clearProgress(); // Borrar progreso del test terminado
        renderChart(results);

        document.getElementById('showCorrectionBtn').addEventListener('click', () => {
            renderCorrection(results);
        });
    }

    function renderCorrection(results) {
        testContainer.innerHTML = '<h2>Revisión de respuestas</h2>';
        
        testData.questions.forEach((q, idx) => {
            const r = results[idx];
            const markClass = userMarks[idx] ? `eval-${userMarks[idx]}` : '';
            const markLabel = userMarks[idx] === 'blue' ? 'Lo sabía bien' : (userMarks[idx] === 'yellow' ? 'Dudé' : 'No lo sabía');
            
            const card = document.createElement('div');
            card.className = 'question-card';
            if (userMarks[idx]) {
                card.style.borderLeft = `5px solid ${userMarks[idx] === 'blue' ? '#007bff' : (userMarks[idx] === 'yellow' ? '#ffc107' : '#dc3545')}`;
            }
            
            let optionsHtml = '';
            q.options.forEach(opt => {
                const optLetter = opt.split(')')[0].trim();
                let extraClass = '';
                
                if (optLetter === q.correctAnswer) {
                    extraClass = 'option-correct';
                } else if (optLetter === r.userAns && !r.isCorrect) {
                    extraClass = 'option-incorrect';
                }

                optionsHtml += `
                    <li>
                        <label class="${extraClass}">
                            <input type="radio" disabled ${optLetter === r.userAns ? 'checked' : ''}>
                            ${opt}
                        </label>
                    </li>
                `;
            });

            card.innerHTML = `
                <div class="difficult-question-meta">Tu valoración: <strong>${markLabel}</strong></div>
                <p><strong>${idx + 1}. ${q.question}</strong></p>
                <ul>${optionsHtml}</ul>
                ${!r.isCorrect ? `<div class="correct-answer-text">La respuesta correcta era la <strong>${q.correctAnswer}</strong>.</div>` : ''}
                ${q.explicacion ? `<div class="correct-answer-text"><strong>Explicación:</strong> ${q.explicacion}</div>` : ''}
            `;
            testContainer.appendChild(card);
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function saveHistory(correctCount, total, percentage, nota) {
        const date = new Date().toLocaleString();
        const stored = JSON.parse(localStorage.getItem('testTcaeHistory')) || [];
        stored.push({ date, test: currentTestFile, correct: correctCount, total, percentage, nota });
        localStorage.setItem('testTcaeHistory', JSON.stringify(stored));
    }

    function renderHistory() {
        hideAllAreas();
        testContainer.style.display = 'block';
        
        const stored = JSON.parse(localStorage.getItem('testTcaeHistory')) || [];

        if (stored.length === 0) {
            testContainer.innerHTML = `<p style="text-align:center;">No hay resultados guardados en el historial.</p>`;
            return;
        }

        const tableHtml = `
            <h2>Historial de Resultados</h2>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Test</th>
                        <th>Nota (s/10)</th>
                        <th>Aciertos</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>
                    ${stored.slice().reverse().map(entry => `
                        <tr>
                            <td>${entry.date}</td>
                            <td>${entry.test.replace('.json', '')}</td>
                            <td style="font-weight:bold; color: ${entry.nota >= 5 ? 'var(--color-success)' : 'var(--color-danger)'}">${entry.nota}</td>
                            <td>${entry.correct} / ${entry.total}</td>
                            <td>${entry.percentage}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        testContainer.innerHTML = tableHtml;
    }

    function renderDifficultQuestions() {
        hideAllAreas();
        difficultQuestionsArea.style.display = 'block';
        
        const difficultQs = JSON.parse(localStorage.getItem('testTcaeDifficult')) || [];
        
        if (difficultQs.length === 0) {
            difficultQuestionsArea.innerHTML = `
                <h2>Preguntas a Repasar</h2>
                <p style="text-align:center; margin-top:2rem;">¡Excelente! No tienes preguntas marcadas como dudosas o falladas.</p>
            `;
            return;
        }

        // Agrupar por color (rojo primero, amarillo después)
        const sortedQs = difficultQs.sort((a, b) => {
            if (a.mark === 'red' && b.mark === 'yellow') return -1;
            if (a.mark === 'yellow' && b.mark === 'red') return 1;
            return 0;
        });

        let html = `<h2>Preguntas a Repasar (${sortedQs.length})</h2><div style="margin-top: 1.5rem;">`;
        
        sortedQs.forEach((q, index) => {
            const markLabel = q.mark === 'red' ? 'No lo sabía / Fallé' : 'Dudé / Detalles';
            const markClass = q.mark === 'red' ? 'marked-red' : 'marked-yellow';
            
            let optionsHtml = q.options.map(opt => {
                const optLetter = opt.split(')')[0].trim();
                const isCorrect = optLetter === q.correctAnswer;
                return `<li><span style="color: ${isCorrect ? 'var(--color-success)' : 'inherit'}; font-weight: ${isCorrect ? 'bold' : 'normal'}">${opt}</span></li>`;
            }).join('');

            html += `
                <div class="difficult-question-item ${markClass}">
                    <div class="difficult-question-meta">
                        Test: ${q.test.replace('.json', '')} | Pregunta ${q.qIndex + 1} | <strong style="color: ${q.mark === 'red' ? '#dc3545' : '#ffc107'}">${markLabel}</strong>
                    </div>
                    <p style="font-weight: bold; margin-bottom: 1rem;">${q.questionText}</p>
                    <ul style="list-style:none;">${optionsHtml}</ul>
                </div>
            `;
        });
        
        html += `</div>`;
        difficultQuestionsArea.innerHTML = html;
    }

    function renderStats() {
        hideAllAreas();
        statsArea.style.display = 'block';
        
        const history = JSON.parse(localStorage.getItem('testTcaeHistory')) || [];
        const difficultQs = JSON.parse(localStorage.getItem('testTcaeDifficult')) || [];
        
        let totalTests = history.length;
        let totalQuestionsAnswered = 0;
        let totalCorrect = 0;
        
        history.forEach(h => {
            totalQuestionsAnswered += h.total;
            totalCorrect += h.correct;
        });

        const globalPercentage = totalQuestionsAnswered > 0 ? ((totalCorrect / totalQuestionsAnswered) * 100).toFixed(2) : 0;
        const totalDifficult = difficultQs.length;
        const totalReds = difficultQs.filter(q => q.mark === 'red').length;
        const totalYellows = difficultQs.filter(q => q.mark === 'yellow').length;

        statsArea.innerHTML = `
            <h2>Estadísticas Globales</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalTests}</div>
                    <div class="stat-label">Tests Realizados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalQuestionsAnswered}</div>
                    <div class="stat-label">Preguntas Respondidas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: ${globalPercentage >= 50 ? 'var(--color-success)' : 'var(--color-danger)'}">${globalPercentage}%</div>
                    <div class="stat-label">Acierto Global</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: var(--color-primary)">${totalDifficult}</div>
                    <div class="stat-label">Preguntas a Repasar</div>
                    <div style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--color-text-muted);">
                        <span style="color: #dc3545; font-weight:bold;">${totalReds} Rojas</span> / 
                        <span style="color: #ffc107; font-weight:bold;">${totalYellows} Amarillas</span>
                    </div>
                </div>
            </div>
        `;
    }

    function clearHistory() {
        if (confirm('¿Estás seguro de que quieres borrar el historial, el progreso guardado y las preguntas difíciles?')) {
            localStorage.removeItem('testTcaeHistory');
            localStorage.removeItem('testTcaeProgress');
            localStorage.removeItem('testTcaeDifficult');
            hideAllAreas();
            testContainer.style.display = 'block';
            testContainer.innerHTML = `<p style="text-align:center; color: var(--color-success)">Todos los datos han sido borrados.</p>`;
        }
    }

    function exportData() {
        const data = {
            history: JSON.parse(localStorage.getItem('testTcaeHistory')) || [],
            progress: JSON.parse(localStorage.getItem('testTcaeProgress')) || {},
            difficult: JSON.parse(localStorage.getItem('testTcaeDifficult')) || []
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test_tcae_datos_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.history || data.progress || data.difficult) {
                    if (data.history) localStorage.setItem('testTcaeHistory', JSON.stringify(data.history));
                    if (data.progress) localStorage.setItem('testTcaeProgress', JSON.stringify(data.progress));
                    if (data.difficult) localStorage.setItem('testTcaeDifficult', JSON.stringify(data.difficult));
                    
                    alert('Datos importados correctamente. La página se recargará.');
                    location.reload();
                } else {
                    alert('El archivo no parece contener datos válidos del test.');
                }
            } catch (err) {
                alert('Error al leer el archivo. Asegúrate de que es el archivo JSON exportado.');
            }
            importDataInput.value = ''; // Reset
        };
        reader.readAsText(file);
    }

    function renderChart(results) {
        chartArea.style.display = 'block';
        const ctx = resultsChartCanvas.getContext('2d');
        
        if (resultsChartInstance) {
            resultsChartInstance.destroy();
        }

        const labels = results.map((_, i) => `P${i + 1}`);
        const dataVals = results.map(r => r.isCorrect ? 1 : 0);
        const bgColors = results.map(r => r.isCorrect ? '#28a745' : '#dc3545');

        resultsChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '1 = Acertada, 0 = Fallada',
                    data: dataVals,
                    backgroundColor: bgColors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1.2,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
});