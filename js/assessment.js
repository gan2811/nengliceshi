// 全局变量
let selectedSections = new Map(); // 存储已选择的模块和题目数量
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let currentAssessmentData = null; // 存储当前测评的完整数据
let timerInterval = null; // 存储计时器
let currentSessionStartTime = null; // **** 新增：记录当前活动会话开始时间 ****

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    // 绑定按钮事件 (如果测评区域已加载)
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const pauseBtn = document.getElementById('pauseBtn'); // <-- Changed ID from terminateBtn

    if (submitBtn) {
        submitBtn.addEventListener('click', submitAssessment);
        submitBtn.disabled = true; // 初始禁用
    }
    if (prevBtn) {
         prevBtn.addEventListener('click', showPreviousQuestion);
    }
    if (nextBtn) {
         nextBtn.addEventListener('click', showNextQuestion);
    }
    if (pauseBtn) { // <-- Changed variable name
         pauseBtn.addEventListener('click', pauseAssessment); // <-- Changed function name
    }

    // **** 新增：键盘事件监听 ****
    document.addEventListener('keydown', handleKeydown);

    // 检查是否有正在进行的测评
    const savedAssessment = localStorage.getItem('currentAssessment');
    if (savedAssessment) {
        currentAssessmentData = JSON.parse(savedAssessment);
        currentQuestions = currentAssessmentData.questions;
        currentQuestionIndex = currentAssessmentData.currentQuestionIndex !== undefined ? currentAssessmentData.currentQuestionIndex : 0;
        userAnswers = currentAssessmentData.answers;
        // **** 确保加载累计的活动时间 ****
        currentAssessmentData.totalActiveSeconds = currentAssessmentData.totalActiveSeconds || 0; // 确保该字段存在并初始化
        
        // **** 调用 displayUserInfo 显示信息 ****
        displayUserInfo(currentAssessmentData.userInfo);

        // 隐藏信息表单，显示测评区域
        document.getElementById('userInfoForm').classList.add('d-none');
        document.getElementById('assessmentArea').classList.remove('d-none');

        // 恢复计时器状态 (显示总流逝时间)
        const assessmentStartTime = new Date(currentAssessmentData.startTime);
        const elapsedSeconds = currentAssessmentData.elapsedSeconds || 0; // 这是总流逝时间
        startTimer(assessmentStartTime, elapsedSeconds); 

        // 生成导航并显示当前题目
        generateQuestionNavigation(); // Generate buttons first
        showQuestion(currentQuestionIndex); // Then show the correct question
        updateProgressAndStatus(); // Update counts
        updateSubmitButton(); // Update submit button state
        
    } else {
        // 没有正在进行的测评，显示信息表单
        document.getElementById('userInfoForm').classList.remove('d-none');
        document.getElementById('assessmentArea').classList.add('d-none');
    }
});

// **** 新增：处理键盘事件 ****
function handleKeydown(event) {
    // 检查测评区域是否可见，以及按键是否为右箭头
    const assessmentArea = document.getElementById('assessmentArea');
    if (assessmentArea && !assessmentArea.classList.contains('d-none')) {
        // 避免在输入框或文本域中触发
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        if (event.key === 'ArrowRight') {
            event.preventDefault(); // 阻止默认滚动行为
            const nextBtn = document.getElementById('nextBtn');
            // 检查按钮是否可用并模拟点击（或直接调用函数）
            if (nextBtn && !nextBtn.disabled) {
                showNextQuestion();
            }
        } else if (event.key === 'ArrowLeft') {
             event.preventDefault(); // 阻止默认滚动行为
             const prevBtn = document.getElementById('prevBtn');
            if (prevBtn && !prevBtn.disabled) {
                showPreviousQuestion();
            }
        }
    }
}

// 新增：根据岗位代码获取岗位名称
function getPositionName(code) {
    const positionMap = {
        'duty_station': '值班站长',
        'station_duty': '车站值班员',
        'station_safety': '站务安全员'
        // 在这里可以根据需要添加更多岗位
    };
    return positionMap[code] || code; // 如果找不到映射，返回原始代码
}

// **** 新增：根据车站代码获取车站名称 ****
function getStationName(code) {
    const stationMap = {
        'grand_hall': '大礼堂',
        'seven_hills': '七星岗',
        'houbao': '后堡',
        'wanshou': '万寿路',
        'nanhu': '南湖',
        'lanhua': '兰花路'
        // 可以根据需要添加更多车站
    };
    return stationMap[code] || code; // 如果找不到映射，返回原始代码
}

// 初始化表单
function initializeForm() {
    const form = document.getElementById('basicInfoForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault(); // 阻止表单默认提交行为
        // 不在这里调用 startAssessment，只在点击开始按钮时调用
    });

    // 动态加载岗位选项
    const positionDropdown = document.getElementById('position');
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const positions = new Set();

    questionBank.forEach(q => {
        if (q.position && Array.isArray(q.position)) {
            q.position.forEach(p => {
                if (p && p !== 'all') { // 排除 'all'
                    positions.add(p);
                }
            });
        } else if (q.position && typeof q.position === 'string' && q.position !== 'all') {
            positions.add(q.position); // 处理单个字符串岗位
        }
    });

    // 清空现有选项 (保留第一个默认选项)
    while (positionDropdown.options.length > 1) {
        positionDropdown.remove(1);
    }

    // 添加从题库提取的岗位
    positions.forEach(pos => {
        const option = document.createElement('option');
        option.value = pos;
        option.textContent = getPositionName(pos); // 使用中文名称
        positionDropdown.appendChild(option);
    });

    // 添加岗位选择变化监听器
    positionDropdown.addEventListener('change', loadSections);

    // 绑定开始按钮点击事件
    const startBtn = document.getElementById('startBtn');
    startBtn.addEventListener('click', function(e) {
        e.preventDefault(); // 阻止按钮默认行为
        startAssessment(); // 只在点击开始按钮时开始测评
    });

    // 初始化时触发一次，以防页面加载时已有岗位被选中（例如浏览器记住选择）
    loadSections();
    updateStartButton(); // 确保按钮状态正确
}

// 加载模块选择卡片 (修改版)
function loadSections() {
    const position = document.getElementById('position').value;
    const startBtn = document.getElementById('startBtn');
    const startBtnHint = document.getElementById('startBtnHint');
    const sectionSelectionDiv = document.getElementById('sectionSelection');

    if (!position) {
        sectionSelectionDiv.classList.add('d-none');
        startBtn.disabled = true;
        return;
    }

    const sectionCards = document.getElementById('sectionCards');
    sectionCards.innerHTML = '';
    selectedSections.clear(); // 清空之前选择的随机题数量

    // 获取该岗位的题目
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const positionQuestions = questionBank.filter(q =>
        q.position && (q.position.includes(position) || q.position.includes('all'))
    );

    // **** START: New section details aggregation ****
    const sectionDetails = {};
    const sectionOrder = {};
    positionQuestions.forEach((q, index) => {
        const sectionName = q.section || '未分类'; // Use '未分类' for questions without a section
        if (!(sectionName in sectionOrder)) {
            sectionOrder[sectionName] = index;
        }
        if (!sectionDetails[sectionName]) {
            sectionDetails[sectionName] = { requiredCount: 0, randomCount: 0 };
        }
        if (q.type === 'required') {
            sectionDetails[sectionName].requiredCount++;
        } else if (q.type === 'random') {
            sectionDetails[sectionName].randomCount++;
        }
    });
    // **** END: New section details aggregation ****

    // 如果没有板块，隐藏选择区域
    const sectionEntries = Object.entries(sectionDetails);
    if (sectionEntries.length === 0) {
        sectionSelectionDiv.classList.add('d-none'); // Hide if no sections at all
        if (startBtnHint) startBtnHint.textContent = '开始测评 (无板块题目)';
        updateStartButton(); // Update button state
        return;
    }

    // **** 新增：排序板块，将只有必答题的放到最后 ****
    sectionEntries.sort(([sectionA, detailsA], [sectionB, detailsB]) => { 
        const hasRandomA = detailsA.randomCount > 0;
        const hasRandomB = detailsB.randomCount > 0;

        // 1. 只有必答题的板块排在最后
        if (hasRandomA && !hasRandomB) {
            return -1; // A (有随机) 排在 B (无随机) 前面
        }
        if (!hasRandomA && hasRandomB) {
            return 1; // B (有随机) 排在 A (无随机) 后面
        }

        // 2. 如果都有随机题 或 都只有必答题，则按题库原始顺序排序
        const orderA = sectionOrder[sectionA];
        const orderB = sectionOrder[sectionB];
        return orderA - orderB; 
    });

    // **** 遍历排序后的板块 ****
    sectionEntries.forEach(([section, details]) => {
        const { requiredCount, randomCount } = details;
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-3'; // Use Bootstrap grid
        const inputId = `section-count-${section.replace(/\s+/g, '-')}`;
        const isDisabled = randomCount === 0; // Disable input if no random questions

        // 定义模块图标映射
        const sectionIcons = {
            "综合监控及IBP盘操作": "bi-display",
            "应急处置": "bi-exclamation-triangle",
            "票务知识": "bi-ticket-perforated",
            "行车知识": "bi-train-front",
            "客运服务": "bi-people",
            "安全生产": "bi-shield-check",
            "规章制度": "bi-journal-bookmark-fill",
            "默认": "bi-grid" // 默认图标
        };
        const iconClass = sectionIcons[section] || sectionIcons["默认"];

        card.innerHTML = `
            <div class="card h-100 module-card ${isDisabled ? 'bg-light' : ''}">
                <div class="card-body">
                    <h6 class="card-title d-flex align-items-center">
                        <i class="bi ${iconClass} me-2"></i>
                        ${section}
                    </h6>
                    <p class="card-text small text-muted mb-1">必答题数量: ${requiredCount}</p>
                    <p class="card-text small ${isDisabled ? 'text-secondary' : 'text-muted'} mb-2">可选随机题数量: ${randomCount}</p>
                    <div class="input-group input-group-sm ${isDisabled ? 'd-none' : ''}"> 
                         <button class="btn btn-outline-secondary btn-sm" type="button" onclick="changeValue('${inputId}', -1, ${randomCount})" ${isDisabled ? 'disabled' : ''}>-</button>
                         <input type="number" class="form-control section-count-input"
                                id="${inputId}"
                                data-section="${section}"
                                min="0" max="${randomCount}"
                                value="0"
                                oninput="updateSelectedSection(this)"
                                ${isDisabled ? 'disabled' : ''}>
                         <button class="btn btn-outline-secondary btn-sm" type="button" onclick="changeValue('${inputId}', 1, ${randomCount})" ${isDisabled ? 'disabled' : ''}>+</button>
                    </div>
                    ${isDisabled ? '<p class="text-center text-danger small mt-2">(无可选随机题)</p>' : ''}
                </div>
            </div>
        `;
        sectionCards.appendChild(card);
    });

    sectionSelectionDiv.classList.remove('d-none'); // Show the section area
    updateStartButton(); // Update button state based on position selection
}

// 新增: 用于增减按钮的函数
function changeValue(inputId, delta, max) {
    const inputElement = document.getElementById(inputId);
    let currentValue = parseInt(inputElement.value) || 0;
    let newValue = currentValue + delta;

    // 确保值在 0 到 max 之间
    if (newValue < 0) {
        newValue = 0;
    } else if (newValue > max) {
        newValue = max;
    }

    inputElement.value = newValue;
    // 手动触发 input 事件，以便调用 updateSelectedSection
    const event = new Event('input', { bubbles: true });
    inputElement.dispatchEvent(event);
}

// 新增: 更新选中的模块题目数量 (由输入框触发)
function updateSelectedSection(inputElement) {
    const section = inputElement.dataset.section;
    const count = parseInt(inputElement.value);
    const maxCount = parseInt(inputElement.max);

    // 验证输入值，如果无效或超出范围，则重置为0或最大值
    let finalCount = 0;
    if (!isNaN(count)) {
        if (count < 0) {
            finalCount = 0;
        } else if (count > maxCount) {
            finalCount = maxCount;
        } else {
            finalCount = count;
        }
    }
    
    // 更新输入框的值以反映验证结果
    if (inputElement.value !== String(finalCount)) {
        inputElement.value = finalCount;
    }

    selectedSections.set(section, finalCount);
    // console.log("Selected sections updated:", selectedSections);

    // 更新开始按钮状态
    updateStartButton();
}

// 更新开始按钮状态 (简化)
function updateStartButton() {
    const startBtn = document.getElementById('startBtn');
    const startBtnHint = document.getElementById('startBtnHint');
    const hasSelectedQuestions = Array.from(selectedSections.values()).some(count => count > 0);
    const positionValue = document.getElementById('position').value;

    if (startBtn) {
        startBtn.disabled = !positionValue;
    }

    if (startBtnHint) {
        const sectionCards = document.getElementById('sectionCards');
        const hasRandomModules = sectionCards && sectionCards.children.length > 0;

        if (hasSelectedQuestions) {
            startBtnHint.textContent = '可以开始测评 (包含选答题)';
            startBtnHint.classList.remove('text-muted');
            startBtnHint.classList.add('text-success');
        } else if (hasRandomModules) {
            startBtnHint.textContent = '输入选答题数量或直接开始 (仅必答题)';
            startBtnHint.classList.remove('text-success');
            startBtnHint.classList.add('text-muted');
        } else {
            startBtnHint.textContent = '开始测评 (仅必答题)';
            startBtnHint.classList.remove('text-success');
            startBtnHint.classList.add('text-muted');
        }
    }
}

// **** 新增：显示用户信息的函数 ****
function displayUserInfo(userData) {
    if (!userData) return;
    document.getElementById('userInfoName').textContent = userData.name || '-';
    document.getElementById('userInfoEmployeeId').textContent = userData.employeeId || '-';
    document.getElementById('userInfoStation').textContent = getStationName(userData.station) || '-';
    document.getElementById('userInfoPosition').textContent = userData.positionName || getPositionName(userData.position) || '-'; 
}

// 开始测评
function startAssessment() {
    // **** 添加日志 ****
    // console.log("[startAssessment] Function called.");

    const name = document.getElementById('name').value;
    const employeeId = document.getElementById('employeeId').value;
    const station = document.getElementById('station').value;
    const position = document.getElementById('position').value;

    if (!name || !employeeId || !station || !position) {
        alert('请填写完整的姓名、工号、车站和岗位信息');
        return;
    }

    const userInfo = {
        name: name,
        employeeId: employeeId,
        station: station, // Assuming you want to store the selected station text
        position: position, // Store the position code
        positionName: document.getElementById('position').selectedOptions[0]?.text || position // Store position name
    };

    // 获取该岗位所有题目
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const positionQuestions = questionBank.filter(q => 
        q.position && (Array.isArray(q.position) ? q.position.includes(position) : q.position === position || q.position.includes('all'))
    );

    // **** 添加日志 ****
    // console.log(`[startAssessment] Found ${positionQuestions.length} questions for position '${position}'.`);

    // 1. 筛选出所有必答题
    const requiredQuestions = positionQuestions.filter(q => q.type === 'required');

    // 2. 根据 selectedSections 从各模块随机抽取选答题
    let randomSelectedQuestions = [];
    selectedSections.forEach((count, section) => {
        if (count > 0) {
            // 筛选出该模块的选答题
            const sectionRandomQuestions = positionQuestions.filter(q => q.section === section && q.type === 'random');
            // 随机抽取指定数量
            const randomQuestions = getRandomQuestions(sectionRandomQuestions, count);
            randomSelectedQuestions.push(...randomQuestions);
        }
    });

    // 3. 合并必答题和选答题
    const finalSelectedQuestions = [...requiredQuestions, ...randomSelectedQuestions];
    
    // **** 添加日志 ****
    // console.log(`[startAssessment] Total required: ${requiredQuestions.length}, Total random selected: ${randomSelectedQuestions.length}, Final selected: ${finalSelectedQuestions.length}`);
    
    // 如果最终没有题目（例如只有选答题模块但用户没选），则提示
    if (finalSelectedQuestions.length === 0) {
        alert('没有选中任何题目，请确认岗位设置或模块选择。');
        return;
    }

    const assessmentStartTime = new Date(); // 测评总开始时间

    // 保存测评信息
    currentAssessmentData = {
        id: Date.now(),
        userInfo: userInfo,
        position: position, // Keep position code here for filtering
        questions: finalSelectedQuestions.map(q => ({ // 只存储题目核心信息，减少冗余
            id: q.id,
            content: q.content,
            standardScore: q.standardScore,
            standardAnswer: q.standardAnswer, // 保留标准答案用于结果页对比
            section: q.section,
            type: q.type,
            knowledgeSource: q.knowledgeSource // <-- 添加这一行
        })),
        answers: {}, // 初始化为空对象
        startTime: assessmentStartTime.toISOString(), // 总开始时间
        status: 'in_progress',
        totalActiveSeconds: 0 // **** 初始化活动时间 ****
    };

    // 初始化答案对象，并设置第一题的开始时间
    currentAssessmentData.questions.forEach((q, index) => {
        currentAssessmentData.answers[q.id] = {
            score: null,
            comment: '',
            startTime: index === 0 ? assessmentStartTime.toISOString() : null, // 只有第一题立即记录开始时间
            duration: 0 // 初始化用时为0
        };
    });
    
    currentQuestions = currentAssessmentData.questions;
    userAnswers = currentAssessmentData.answers; // 引用
    currentQuestionIndex = 0; // 从第一题开始

    localStorage.setItem('currentAssessment', JSON.stringify(currentAssessmentData)); // 保存初始状态
    
    // **** 添加日志 ****
    // console.log("[startAssessment] Hiding user info form, showing assessment area.");
    // 显示测评区域
    document.getElementById('userInfoForm').classList.add('d-none');
    document.getElementById('assessmentArea').classList.remove('d-none');
    document.getElementById('timer').textContent = '00:00'; // 重置计时器显示

    // **** 新增：更新总题数并生成导航按钮 ****
    document.getElementById('totalQuestions').textContent = currentQuestions.length;
    generateQuestionNavigation(); 

    // 开始计时器
    startTimer(assessmentStartTime); // 首次开始，从0开始计时

    // **** 调用 displayUserInfo 显示信息 ****
    displayUserInfo(currentAssessmentData.userInfo);

    // **** 添加日志 ****
    // console.log("[startAssessment] Calling displayCurrentQuestion for the first time.");
    // 显示第一题
    displayCurrentQuestion(); 
}

// 获取随机题目
function getRandomQuestions(questions, count) {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// 更新显示题目
function displayCurrentQuestion() {
    // **** 添加详细日志 ****
    // console.log("[displayCurrentQuestion] Function called for index:", currentQuestionIndex);
    if (currentQuestionIndex < 0 || currentQuestionIndex >= currentQuestions.length) {
        console.error("[displayCurrentQuestion] Invalid question index:", currentQuestionIndex);
        return; 
    }
    // console.log("[displayCurrentQuestion] Current question data:", JSON.parse(JSON.stringify(currentQuestions[currentQuestionIndex])));

    const question = currentQuestions[currentQuestionIndex];
    // 使用 HTML 中实际存在的 ID
    const progressElement = document.getElementById('currentQuestionNumber'); 
    const questionContentElement = document.getElementById('questionContentText'); 
    const standardAnswerElement = document.getElementById('standardAnswerText'); 
    const scoreInputElement = document.getElementById('scoreInput');
    const commentInputElement = document.getElementById('commentInput');
    const standardScoreDisplayElement = document.getElementById('standardScoreDisplay'); // Get score display element
    
    // 更新检查，只检查核心元素
    if (!progressElement || !questionContentElement || !standardAnswerElement || !scoreInputElement || !commentInputElement || !standardScoreDisplayElement) {
        console.error("[displayCurrentQuestion] Assessment UI elements (progress, content, score display, score input, comment) are missing or have incorrect IDs in assessment.html.");
        // 可以在这里停止执行或采取其他措施，防止后续代码出错
        return; 
    }
    // console.log("[displayCurrentQuestion] All required elements found. Proceeding to update UI.");

    // 更新进度显示格式
    progressElement.textContent = `第 ${currentQuestionIndex + 1} 题 (共 ${currentQuestions.length} 题)`; 
    questionContentElement.textContent = question.content; // 直接设置文本内容
    
    // **** 为标准答案元素添加 preserve-newlines 类 ****
    standardAnswerElement.innerHTML = formatAnswerContent(question.standardAnswer); // 使用 innerHTML 以渲染可能的 HTML
    standardAnswerElement.classList.add('preserve-newlines');

    standardScoreDisplayElement.textContent = question.standardScore !== null ? question.standardScore : 'N/A'; // Display standard score

    // **记录当前题目的开始作答时间 (逻辑保持)**
    const now = new Date().toISOString();
    if (!userAnswers[question.id]) { 
         userAnswers[question.id] = { score: null, comment: '', startTime: now, duration: 0 };
    } else if (!userAnswers[question.id].startTime) { 
        userAnswers[question.id].startTime = now;
        if (userAnswers[question.id].duration === undefined || userAnswers[question.id].duration === null) {
           userAnswers[question.id].duration = 0; 
        }
    }
    
    const currentAnswer = userAnswers[question.id] || {}; // 获取当前答案，确保存在

    // 更新固定的评分和评语输入框的值和属性
    scoreInputElement.value = currentAnswer.score !== null ? currentAnswer.score : ''; // 设置分数，空字符串表示未评分
    scoreInputElement.max = question.standardScore || 100; // 设置最大分
    commentInputElement.value = currentAnswer.comment || ''; // 设置评语

    // 移除旧的动态创建和绑定逻辑
    /*
    // 清空之前的选项/输入区域
    answerOptionsElement.innerHTML = ''; 
    // 创建评分滑块和评语输入框 ...
    // 绑定事件以实时保存评分和评语 ...
    */
   
    // **** 修改：为固定的输入框添加/更新事件监听器 (如果需要实时保存) ****
    // 为确保事件不重复绑定，可以先移除旧监听器（如果存在），或使用 once 选项
    // 这里简化处理：假设每次显示题目时重新绑定是安全的
    scoreInputElement.oninput = () => saveCurrentAnswer(false); // 使用 input 事件实时保存
    commentInputElement.oninput = () => saveCurrentAnswer(false); // 使用 input 事件实时保存

    // 更新导航按钮状态
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    document.getElementById('nextBtn').disabled = currentQuestionIndex === currentQuestions.length - 1;
    document.getElementById('submitBtn').disabled = !checkAllAnswered(); // 提交按钮状态取决于是否所有题目都已回答

    // 更新总览和进度条 (确保调用)
    updateProgressAndStatus();
    updateQuestionNavigation();

    // 将焦点设置到评分输入框
    scoreInputElement.focus(); 
}

// **** 新增辅助函数：检查是否所有题目都已回答 ****
function checkAllAnswered() {
    if (!currentQuestions || currentQuestions.length === 0) return false; // 没有题目不能算完成
    return currentQuestions.every(question => {
        const answer = userAnswers[question.id];
        // 认为有效回答是 score 不为 null 且为数字
        return answer && answer.score !== null && !isNaN(answer.score);
    });
}

// **** 修改保存逻辑：允许切换题目，即使未评分 ****
function saveCurrentAnswer(isNavigating = false) { // Added isNavigating flag
    const scoreInput = document.getElementById('scoreInput');
    const commentInput = document.getElementById('commentInput');
    const questionId = currentQuestions[currentQuestionIndex].id;
    const score = scoreInput.value !== '' ? parseFloat(scoreInput.value) : null; // Keep score as null if empty
    const comment = commentInput.value;
    const standardScore = currentQuestions[currentQuestionIndex].standardScore;

    // Validate score range only if a score is entered (or not navigating)
    // If navigating, we accept null scores without validation for now
    if (score !== null && (isNaN(score) || score < 0 || (standardScore !== null && score > standardScore))) {
        // Don't alert if just navigating away from an unscored question
        if (!isNavigating || score !== null) { 
             alert(`请输入有效的得分 (0 到 ${standardScore !== null ? standardScore : '最大值'})。`);
             scoreInput.focus();
             // If navigating, maybe prevent navigation? Or just save null?
             // For now, just alert and focus, user has to fix or clear it.
             // *Consider the desired UX here carefully*
             // Let's save null if invalid during navigation to allow moving away
             if(isNavigating) {
                 userAnswers[questionId].score = null;
                 userAnswers[questionId].comment = comment;
                 return; // Allow navigation
             }
        }
        // If not navigating, return false to indicate save failed
         // return false; 
         // Let's proceed but save null if invalid
         userAnswers[questionId].score = null; 
    } else {
       userAnswers[questionId].score = score;
    }
    
    userAnswers[questionId].comment = comment;

    // 实时更新进度和提交按钮状态
    updateProgressAndStatus();
    updateSubmitButton(); 
    updateQuestionNavigation(); // **** Call here to update button styles immediately ****
}

// 记录上一题的用时 (在切换或提交时调用)
function recordPreviousQuestionTime() {
     // Check if we came from a valid index
     if (currentQuestionIndex >= 0 && currentQuestionIndex < currentQuestions.length) {
         const previousQuestionId = currentQuestions[currentQuestionIndex].id;
         const answer = userAnswers[previousQuestionId];
         if (answer && answer.startTime) {
             const startTime = new Date(answer.startTime);
             const endTime = new Date();
             const durationSeconds = Math.round((endTime - startTime) / 1000);
             answer.duration = (answer.duration || 0) + durationSeconds; // Accumulate duration if returning to question
             answer.startTime = null; // Reset start time after recording duration
         }
     }
}

// 显示下一题
function showNextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        // **先保存当前题目答案 (允许未评分)**
        saveCurrentAnswer(true); 
        // **再记录当前题目用时**
        recordPreviousQuestionTime();
        
        // 切换到下一题
        currentQuestionIndex++;
        displayCurrentQuestion();
    }
}

// 显示上一题
function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
         // **先保存当前题目答案 (允许未评分)**
         saveCurrentAnswer(true);
        // **再记录当前题目用时**
        recordPreviousQuestionTime(); 
        
        // 切换到上一题
        currentQuestionIndex--;
        displayCurrentQuestion();
    }
}

// 导航到指定题目
function navigateToQuestion(index) {
     // **** 移除这里的 saveCurrentAnswer 调用 ****
    // saveCurrentAnswer(false);
    showQuestion(index);
}

// 更新进度和状态
function updateProgressAndStatus() {
    if (!currentAssessmentData || !currentAssessmentData.answers) return;
    
    const totalQuestions = currentQuestions.length;
    // 重新计算已答数量，确保每次都基于最新的答案状态
    const answeredCount = Object.values(currentAssessmentData.answers).filter(
        answer => answer && answer.score !== null && !isNaN(answer.score)
    ).length;
    const unansweredCount = totalQuestions - answeredCount;

    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('answeredQuestions').textContent = answeredCount;
    document.getElementById('unansweredQuestions').textContent = unansweredCount;
}

// **** 修改：更新题目导航按钮样式 ****
function updateQuestionNavigation() {
    const navContainer = document.getElementById('questionNavButtons');
    if (!navContainer || !currentQuestions || currentQuestions.length === 0) return;
    const buttons = navContainer.querySelectorAll('.question-nav-item');

    buttons.forEach((button, index) => {
        const question = currentQuestions[index]; // Get the full question object
        if (!question) return;
        const questionId = question.id;

        const answer = currentAssessmentData.answers[questionId];
        const isScored = answer && answer.score !== null && !isNaN(answer.score);
        const score = isScored ? answer.score : '--'; // Use '--' if not scored
        const standardScore = question.standardScore !== null ? question.standardScore : '-'; // Handle null standard score

        button.classList.remove('active', 'answered');

        // **** Update the score line (line 2) ****
        const scoreLine = button.querySelector('.qni-line2');
        if (scoreLine) {
            scoreLine.textContent = `${score} / ${standardScore}`;
        }

        if (index === currentQuestionIndex) {
            button.classList.add('active');
        } else if (isScored) {
            button.classList.add('answered');
        }
    });
}

// 添加新函数：更新提交按钮状态
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn || !currentAssessmentData || !currentAssessmentData.answers) {
        return;
    }
    
    // 检查是否所有题目都已评分（分数不是null且是数字）
    const allAnswered = currentQuestions.every(question => {
        const answer = currentAssessmentData.answers[question.id];
        return answer && answer.score !== null && !isNaN(answer.score);
    });
    
    submitBtn.disabled = !allAnswered;
    
    // 如果所有题目已评分，可以添加视觉提示
    if (allAnswered) {
        submitBtn.classList.add('btn-pulse');
        // 如果在最后一题，额外提示用户可以提交
        if (currentQuestionIndex === currentQuestions.length - 1) {
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn) {
                nextBtn.innerHTML = '已完成 <i class="bi bi-check-circle ms-1"></i>';
            }
        }
    } else {
        submitBtn.classList.remove('btn-pulse');
    }
}

// **** 修改：提交测评 ****
function submitAssessment() {
    // **** 新增：在提交前获取测评人姓名 ****
    const assessorName = prompt("请输入测评人姓名：");
    if (assessorName === null || assessorName.trim() === "") {
        alert("测评人姓名不能为空，提交已取消。");
        return; // 中止提交
    }
    // 将测评人姓名存入当前数据
    currentAssessmentData.assessor = assessorName.trim();

    // **先保存最后一题的答案**
    saveCurrentAnswer(false); 
    recordPreviousQuestionTime(); 
    // **** stopTimer() 先不调用 ****

    // **检查所有题目是否都已评分**
    if (!checkAllAnswered()) {
        alert('您有未评分的题目，请完成后再提交。');
        // Maybe restart timer or highlight missing answers?
        // For now, just prevent submission.
         startTimer(new Date(currentAssessmentData.startTime)); // Restart timer
        return;
    }

    // ... (rest of the submit logic: calculate score, confirm if needed, save to history)
    const assessmentEndTime = new Date();
    // ... (calculate duration, score, maxScore as before)
     let totalScore = 0;
    let maxPossibleScore = 0;

    currentAssessmentData.questions.forEach(question => {
        const answer = userAnswers[question.id];
        const standardScore = question.standardScore || 0;
        maxPossibleScore += standardScore;
        // Score calculation relies on checkAllAnswered ensuring score is valid number
        totalScore += (answer && typeof answer.score === 'number') ? answer.score : 0;
        // Ensure duration exists
        if (answer && (answer.duration === undefined || answer.duration === null)) {
             answer.duration = 0;
        }
    });

    // **** 添加日志：检查恢复后的初始活动时间 ****
    const initialTotalActiveSeconds = currentAssessmentData.totalActiveSeconds || 0;

    // **** 计算最后活动会话时长 ****
    let finalSessionDurationSeconds = 0;
    const sessionStartTime = currentSessionStartTime; 
    if (sessionStartTime) {
        finalSessionDurationSeconds = Math.floor((assessmentEndTime - sessionStartTime) / 1000);
    } else {
        console.warn("提交时 currentSessionStartTime 为空，最后会话时长计为0。");
    }

    // **** 在计算完会话时长后，再停止计时器 ****
    stopTimer(); 

    // **** 计算总活动时长 ****
    let totalActiveSeconds = initialTotalActiveSeconds + finalSessionDurationSeconds;

    // 更新 currentAssessmentData
    currentAssessmentData.answers = userAnswers;
    currentAssessmentData.score = totalScore;
    currentAssessmentData.maxScore = maxPossibleScore;
    // **** 使用总活动时间计算最终时长 ****
    currentAssessmentData.duration = Math.round(totalActiveSeconds / 60); 
    currentAssessmentData.status = 'completed';
    currentAssessmentData.timestamp = assessmentEndTime.toISOString();
    currentAssessmentData.totalActiveSeconds = totalActiveSeconds; // 保存最终的总活动秒数

    // **** 新增：计算得分率 ****
    const scoreRate = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    // Save to history
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    const historyRecord = {
        id: currentAssessmentData.id,
        userInfo: currentAssessmentData.userInfo,
        position: currentAssessmentData.position,
        assessor: currentAssessmentData.assessor,
        timestamp: currentAssessmentData.timestamp,
        startTime: currentAssessmentData.startTime, // **** 添加原始 startTime ****
        duration: currentAssessmentData.duration, // 使用计算好的活动分钟数
        score: { 
            totalScore: totalScore,
            maxScore: maxPossibleScore,
            scoreRate: scoreRate
        },
        questions: currentAssessmentData.questions.map(q => ({
             id: q.id,
             content: q.content,
             standardScore: q.standardScore,
             standardAnswer: q.standardAnswer,
             section: q.section,
             type: q.type,
             knowledgeSource: q.knowledgeSource
         })),
        answers: currentAssessmentData.answers,
        status: 'completed', // 标记为完成
        totalActiveSeconds: currentAssessmentData.totalActiveSeconds // 保存活动秒数供参考
    };
    
    // **** 添加日志：检查要保存的记录 ****
    // console.log("[Submit Debug] Final historyRecord to be saved:", JSON.parse(JSON.stringify(historyRecord)));

    // 检查是否已存在相同 ID 的暂停记录，如果存在则替换，否则添加
    const historyWithoutPaused = history.filter(item => !(item.id === historyRecord.id && item.status === 'paused'));
    historyWithoutPaused.push(historyRecord);
    localStorage.setItem('assessmentHistory', JSON.stringify(historyWithoutPaused));

    localStorage.removeItem('currentAssessment');
    // console.log("Assessment submitted and saved to history. Redirecting...");

    window.location.href = `result.html?assessmentId=${currentAssessmentData.id}`;
}

// **** 修改：暂存测评 ****
function pauseAssessment() {
    // 1. 记录当前状态
    if (!currentAssessmentData) {
        console.error("无法暂存：没有当前的测评数据。");
        alert("没有正在进行的测评可以暂存。");
        return;
    }
    
    // **** 保存最后一次答案和时间 ****
    saveCurrentAnswer(true); // Save current state before pausing (isNavigating=true to skip validation if needed)
    recordPreviousQuestionTime(); // Record time for the question before the current one

    // **** 计算当前活动会话时长 ****
    let currentSessionDurationSeconds = 0;
    if (currentSessionStartTime) {
        currentSessionDurationSeconds = Math.floor((new Date() - currentSessionStartTime) / 1000);
    } else {
        console.warn("暂存时 currentSessionStartTime 为空，本次会话时长计为0。");
    }
    stopTimer(); // 停止计时器，清空 currentSessionStartTime

    // **** 累加总活动时长 ****
    currentAssessmentData.totalActiveSeconds = (currentAssessmentData.totalActiveSeconds || 0) + currentSessionDurationSeconds;

    // **** 计算总流逝时间 (用于记录暂停点) ****
    let elapsedSeconds = 0;
    if (currentAssessmentData.startTime) {
        const startTime = new Date(currentAssessmentData.startTime);
        const now = new Date();
        elapsedSeconds = Math.floor((now - startTime) / 1000);
    } 

    // 3. 更新测评数据状态
    currentAssessmentData.status = 'paused';
    currentAssessmentData.elapsedSeconds = elapsedSeconds; // 保存总流逝时间
    currentAssessmentData.currentQuestionIndex = currentQuestionIndex; 
    currentAssessmentData.timestamp = new Date().toISOString(); // 更新时间戳为暂存时间
    // totalActiveSeconds 已经在上面更新过了

    // 4. 保存到历史记录 
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
     const historyRecord = {
        id: currentAssessmentData.id,
        userInfo: currentAssessmentData.userInfo, 
        position: currentAssessmentData.position,
        assessor: currentAssessmentData.assessor || null, // 可能还没有测评人
        timestamp: currentAssessmentData.timestamp, // Use pause time
        startTime: currentAssessmentData.startTime, // **** 添加原始 startTime ****
        duration: Math.round((currentAssessmentData.totalActiveSeconds || 0) / 60),
        score: { totalScore: null, maxScore: currentAssessmentData.maxScore || null, scoreRate: null },
        questions: currentAssessmentData.questions,
        answers: currentAssessmentData.answers,
        status: 'paused',
        elapsedSeconds: currentAssessmentData.elapsedSeconds, // 保存总流逝秒数
        currentQuestionIndex: currentAssessmentData.currentQuestionIndex,
        totalActiveSeconds: currentAssessmentData.totalActiveSeconds // **** 保存活动总秒数 ****
    };

    // 检查是否已存在相同 ID 的暂停记录，如果存在则替换，否则添加
    const existingIndex = history.findIndex(item => item.id === historyRecord.id);
    if (existingIndex > -1) {
        history[existingIndex] = historyRecord; // Update existing paused record
    } else {
        history.push(historyRecord); // Add as new paused record
    }
    localStorage.setItem('assessmentHistory', JSON.stringify(history));

    // 5. 清除当前测评状态并重定向
    localStorage.removeItem('currentAssessment');
    // console.log("Assessment paused and saved to history. Redirecting...");
    alert("测评已暂存！"); // Inform user
    window.location.href = 'history.html'; // Redirect to history page
}

// 启动计时器 (修改：记录会话开始时间)
function startTimer(startTime, initialElapsedSeconds = 0) {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    const timerElement = document.getElementById('timer');
    let elapsedSeconds = initialElapsedSeconds; 

    // Immediately update timer display with initial time
    const initialMinutes = Math.floor(elapsedSeconds / 60);
    const initialSeconds = elapsedSeconds % 60;
    timerElement.textContent = `${String(initialMinutes).padStart(2, '0')}:${String(initialSeconds).padStart(2, '0')}`;

    // **** 记录当前会话开始时间 ****
    currentSessionStartTime = new Date(); 

    timerInterval = setInterval(() => {
        elapsedSeconds++; 
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

// 停止计时器 (修改：清空会话开始时间)
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    // **** 清空会话开始时间 ****
    currentSessionStartTime = null; 
}

// **** 添加 formatAnswerContent 函数（如果 assessment.js 中没有） ****
function formatAnswerContent(content) {
    if (!content) return '无标准答案';
    // 基础实现，可以扩展以处理其他格式
    return content.replace(/<img /g, '<img class="img-fluid" '); // 使图片自适应
}

// 添加新函数：生成题目导航按钮 (逻辑不变，但确保调用 updateQuestionNavigation)
function generateQuestionNavigation() {
    const navContainer = document.getElementById('questionNavButtons');
    if (!navContainer || !currentQuestions || currentQuestions.length === 0) return;

    navContainer.innerHTML = ''; // Clear existing buttons

    currentQuestions.forEach((question, index) => {
        const button = document.createElement('button');
        button.dataset.index = index;
        button.className = 'btn btn-sm question-nav-item'; // Use custom class

        // **** Set innerHTML with two lines ****
        const standardScore = question.standardScore !== null ? question.standardScore : '-'; // Handle null standard score
        button.innerHTML = `
            <span class="qni-line1">第 ${index + 1} 题</span>
            <span class="qni-line2">-- / ${standardScore}</span>
        `;

        button.onclick = () => showQuestion(index);
        navContainer.appendChild(button);
    });

    updateQuestionNavigation();
}

// 添加新函数：显示指定题目 (逻辑不变)
function showQuestion(index) {
    if (index < 0 || index >= currentQuestions.length) {
        console.error("Invalid question index:", index);
        return;
    }

    currentQuestionIndex = index;
    displayCurrentQuestion();
} 