// 全局变量
let selectedSections = new Map(); // 存储已选择的模块和题目数量
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let currentAssessmentData = null; // 存储当前测评的完整数据 (会包含 objectId)
let timerInterval = null; // 存储计时器
let currentSessionStartTime = null; // 记录当前活动会话开始时间

// **** 新增：本地存储键名 ****
const LOCAL_STORAGE_KEY = 'activeAssessmentState';

// **** 页面加载时的核心逻辑 (修改版) ****
document.addEventListener('DOMContentLoaded', async function() {
    console.log("[DOMContentLoaded in assessment.js] Initializing...");
    showLoading("正在初始化应用...");
    let stateResumed = false; // **** 新增：标志，跟踪本地状态是否已恢复 ****

    // 确保 currentUser 已由 main.js 设置 (再次检查)
    if (!currentUser && typeof AV !== 'undefined' && AV.User) {
        currentUser = AV.User.current();
    }

    // **** 1. 检查本地存储是否有未完成的测评 ****
    let localState = null;
    try {
        const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedState) {
            localState = JSON.parse(storedState);
            console.log("Found locally stored assessment state:", localState);
            stateResumed = true; // **** 新增：标记状态已成功恢复 ****
            console.log("[DOMContentLoaded] Local state successfully resumed. stateResumed set to true."); // **** 新增日志 ****
        }
    } catch (e) {
        console.error("Error parsing locally stored assessment state:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // 解析失败则移除
    }

    if (localState && (localState.status === '进行中' || localState.status === 'paused')) {
        // 发现本地状态，询问用户
        if (confirm('发现您上次有未完成的测评，是否继续？\n(选择"确定"继续，选择"取消"将放弃上次进度)')) {
            console.log("User chose to resume local state.");
            // 用户选择继续 -> 加载本地状态
            currentAssessmentData = localState;
            currentQuestions = currentAssessmentData.questions || [];
            userAnswers = currentAssessmentData.answers || {};
            let loadedIndex = currentAssessmentData.currentQuestionIndex !== undefined ? currentAssessmentData.currentQuestionIndex : 0;
            if (loadedIndex < 0 || loadedIndex >= currentQuestions.length) loadedIndex = 0;
            currentQuestionIndex = loadedIndex;

            // 清除本地存储 (状态已加载到内存)
            localStorage.removeItem(LOCAL_STORAGE_KEY);

            // 显示测评界面并恢复
            document.getElementById('userInfoForm')?.classList.add('d-none');
            document.getElementById('assessmentArea')?.classList.remove('d-none');
            displayUserInfo({
                name: currentAssessmentData.employeeName,
                employeeId: currentAssessmentData.employeeId,
                stationCode: currentAssessmentData.stationCode,
                positionCode: currentAssessmentData.positionCode,
                positionName: currentAssessmentData.positionName
            });
            startTimer(new Date(), currentAssessmentData.totalActiveSeconds || 0); // 使用 totalActiveSeconds 恢复计时器
            generateQuestionNavigation();
            displayCurrentQuestion();
            updateSubmitButton();
            hideLoading();
            stateResumed = true; // **** 新增：标记状态已成功恢复 ****
            console.log("[DOMContentLoaded] Local state successfully resumed. stateResumed set to true."); // **** 新增日志 ****
        } else {
            // 用户选择放弃 -> 清除本地状态，继续正常流程
            console.log("User chose to discard local state.");
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }

    // **** 2. 只有在未从本地恢复状态时，才检查 URL resumeId 或显示设置表单 ****
    if (!stateResumed) {
        console.log("[DOMContentLoaded] Local state not resumed. Checking URL resumeId or showing setup form..."); // **** 新增日志 ****
        const urlParams = new URLSearchParams(window.location.search);
        const resumeId = urlParams.get('resumeId');

        if (resumeId && currentUser) {
            console.log(`[assessment.js] No local state or user discarded. Found resumeId in URL: ${resumeId}. Attempting to resume from cloud.`);
            await checkResumableAssessment(resumeId); // 从云端恢复
            hideLoading();
        } else if (!currentUser) {
            console.log("[assessment.js] No local state/resumeId. User not logged in. Showing setup form.");
            document.getElementById('userInfoForm')?.classList.remove('d-none');
            document.getElementById('assessmentArea')?.classList.add('d-none');
            initializeForm();
            hideLoading();
        } else {
            console.log(`[assessment.js] No local state/resumeId. User logged in: ${currentUser.getUsername()}. Showing setup form.`);
            document.getElementById('userInfoForm')?.classList.remove('d-none');
            document.getElementById('assessmentArea')?.classList.add('d-none');
            initializeForm();
            hideLoading();
        }
    }
    // **** 结束条件检查 ****
    else { // **** 新增 else 块和日志 ****
         console.log("[DOMContentLoaded] Skipping URL/Setup form checks because local state was resumed.");
    }

    // **** 按钮事件绑定 (添加日志) ****
    console.log("[DOMContentLoaded] Setting up button event listeners...");
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    if (submitBtn) {
        console.log("[DOMContentLoaded] Found submitBtn, adding listener.");
        submitBtn.addEventListener('click', submitAssessment);
        submitBtn.disabled = true;
    } else {
        console.warn("[DOMContentLoaded] submitBtn element not found!");
    }
    
    if (prevBtn) {
         console.log("[DOMContentLoaded] Found prevBtn, adding listener.");
         prevBtn.addEventListener('click', showPreviousQuestion);
    } else {
        console.warn("[DOMContentLoaded] prevBtn element not found!");
    }
    
    if (nextBtn) {
         console.log("[DOMContentLoaded] Found nextBtn, adding listener for showNextQuestion.");
         nextBtn.addEventListener('click', showNextQuestion);
    } else {
        console.warn("[DOMContentLoaded] nextBtn element not found! Click event will not work.");
    }
    
    if (pauseBtn) {
         console.log("[DOMContentLoaded] Found pauseBtn, adding listener.");
         pauseBtn.addEventListener('click', pauseAssessment);
    } else {
        console.warn("[DOMContentLoaded] pauseBtn element not found!");
    }
    
    console.log("[DOMContentLoaded] Setting up keydown listener...");
    document.addEventListener('keydown', handleKeydown);
    console.log("[DOMContentLoaded] Button listeners setup complete.");
});

// **** 新增：保存当前测评状态到 localStorage ****
function saveStateToLocalStorage() {
    if (currentAssessmentData && (currentAssessmentData.status === '进行中' || currentAssessmentData.status === 'paused')) {
        try {
             // 更新最新的答案、索引和计时
            currentAssessmentData.answers = userAnswers;
            currentAssessmentData.currentQuestionIndex = currentQuestionIndex;
             // 计算当前会话时长并累加到 totalActiveSeconds
             let currentSessionDurationSeconds = 0;
             if (currentSessionStartTime) {
                 currentSessionDurationSeconds = Math.floor((new Date() - currentSessionStartTime) / 1000);
             } else {
                 // 如果没有会话开始时间（可能发生在页面刚加载，计时器未启动时保存），则不增加时长
             }
             // 注意：这里不停止计时器，只累加时长用于保存。totalActiveSeconds 代表总共花费的时间
             currentAssessmentData.totalActiveSeconds = (currentAssessmentData.totalActiveSeconds || 0) + currentSessionDurationSeconds;
             // 重置会话开始时间，以便下次计算增量
             currentSessionStartTime = new Date(); 

             // 序列化并保存
            const stateString = JSON.stringify(currentAssessmentData);
            localStorage.setItem(LOCAL_STORAGE_KEY, stateString);
            console.log("Assessment state saved to localStorage.");
        } catch (e) {
            console.error("Error saving assessment state to localStorage:", e);
        }
    } else {
        // 如果没有进行中的测评，确保清除本地存储
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
}

// **** 新增：页面卸载前保存状态 ****
window.addEventListener('beforeunload', function(event) {
    console.log("[beforeunload] Saving state before leaving...");
    saveStateToLocalStorage();
    // 不需要设置 event.returnValue 或调用 preventDefault
});

// **** 新增：检查并恢复测评状态的函数，接受 assessmentId ****
async function checkResumableAssessment(assessmentId = null) {
    // **** 只有提供了 assessmentId 才执行恢复 ****
    if (!assessmentId) {
        console.log("checkResumableAssessment called without an assessmentId. Skipping cloud call.");
        // 确保显示设置界面
        document.getElementById('userInfoForm')?.classList.remove('d-none');
        document.getElementById('assessmentArea')?.classList.add('d-none');
        initializeForm(); // 确保表单初始化
        return; // 不执行任何操作
    }

    console.log(`Checking for resumable assessment with ID: ${assessmentId}...`);
    showLoading("正在加载暂停的测评..."); // 显示加载提示
     try {
        // **** 调用云函数，传入ID ****
        const resumableData = await AV.Cloud.run('getResumableAssessment', { assessmentId: assessmentId });

        if (resumableData && resumableData.objectId) {
            console.log(`Found resumable assessment: ${resumableData.objectId}`);
            // **** 验证返回的 objectId 是否与请求的一致 (可选但推荐) ****
            if (resumableData.objectId !== assessmentId) {
                 console.warn(`Requested assessmentId ${assessmentId} but received ${resumableData.objectId}. Proceeding anyway.`);
                 // 或者抛出错误 throw new Error('返回的测评ID与请求的不匹配');
            }

            // **** 权限检查：虽然云函数做了检查，前端也可以再确认一次(如果云函数返回owner信息) ****
            // if (resumableData.ownerId && resumableData.ownerId !== currentUser.id) {
            //     throw new Error('您无权恢复此测评记录');
            // }

            currentAssessmentData = resumableData;
            // currentQuestions = currentAssessmentData.questions || []; // **** 修改：在赋值前补充 standardAnswer ****
            userAnswers = currentAssessmentData.answers || {};
            let loadedIndex = currentAssessmentData.currentQuestionIndex !== undefined ? currentAssessmentData.currentQuestionIndex : 0;

            // **** 新增：从本地题库补充 standardAnswer ****
            let questionsFromBackend = currentAssessmentData.questions || [];
            let localQuestionBank = [];
            try {
                localQuestionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
            } catch (e) {
                console.error("Error loading question bank from localStorage:", e);
            }
            
            const enrichedQuestions = questionsFromBackend.map(backendQuestion => {
                const bankQuestion = localQuestionBank.find(q => q.id == backendQuestion.id); // Use non-strict comparison for safety
                return {
                    ...backendQuestion,
                    standardAnswer: bankQuestion ? bankQuestion.standardAnswer : undefined // Add standardAnswer or undefined
                };
            });
            currentQuestions = enrichedQuestions; // **** 使用补充了答案的题目列表 ****
            // **** 结束补充 ****

            if (loadedIndex < 0 || loadedIndex >= currentQuestions.length) {
                loadedIndex = 0;
            }
            currentQuestionIndex = loadedIndex;
            // ... (加载 index, employeeId 等，与之前逻辑类似) ...
            // currentEmployeeId = currentAssessmentData.employeeId;
            // currentEmployeeName = currentAssessmentData.employeeName;
            // currentPositionCode = currentAssessmentData.positionCode;
            // currentStationCode = currentAssessmentData.stationCode;
            // ...

            console.log("Resuming assessment...");
            // 恢复时：隐藏设置界面，显示测评界面
            document.getElementById('userInfoForm')?.classList.add('d-none');
            document.getElementById('assessmentArea')?.classList.remove('d-none');
            // 更新界面顶部的用户信息显示
            displayUserInfo({
                 name: currentAssessmentData.employeeName,
                 employeeId: currentAssessmentData.employeeId,
                 stationCode: currentAssessmentData.stationCode, // 假设云函数返回这些
                 stationName: currentAssessmentData.stationName, // 假设云函数返回这些
                 positionCode: currentAssessmentData.positionCode, // 假设云函数返回这些
                 positionName: currentAssessmentData.positionName // 假设云函数返回这些
             });

            // 启动计时器
            if (currentAssessmentData.assessmentDate) {
                const assessmentStartTime = new Date(currentAssessmentData.assessmentDate);
                const elapsedSeconds = currentAssessmentData.elapsedSeconds || 0;
                startTimer(assessmentStartTime, elapsedSeconds);
            } else {
                startTimer(new Date(), currentAssessmentData.elapsedSeconds || 0); // Fallback
            }
            displayCurrentQuestion(); // 显示当前题目
            updateSubmitButton(); // 更新提交按钮状态
            generateQuestionNavigation(); // 生成题目导航

        } else {
            // 虽然传入了ID，但云函数没有返回有效数据（可能已被删除或完成）
            console.log(`No resumable assessment found for ID ${assessmentId} or an error occurred in cloud function.`);
            alert(`无法加载ID为 ${assessmentId} 的暂停测评，可能已被删除或已完成。将显示新测评表单。`);
            // 显示设置界面
            document.getElementById('userInfoForm')?.classList.remove('d-none');
            document.getElementById('assessmentArea')?.classList.add('d-none');
            initializeForm(); // 确保表单初始化
        }
    } catch (error) {
        console.error("Error checking resumable assessment:", error);
        alert("加载暂停的测评失败: " + error.message);
        // 出错也显示设置界面
        document.getElementById('userInfoForm')?.classList.remove('d-none');
        document.getElementById('assessmentArea')?.classList.add('d-none');
        initializeForm(); // 确保表单初始化
    } finally {
        hideLoading(); // 确保隐藏加载提示
    }
}

// **** 新增：简单的加载提示 ****
function showLoading(message = "加载中...") {
    let loadingElement = document.getElementById('loadingOverlay');
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loadingOverlay';
        loadingElement.style.position = 'fixed';
        loadingElement.style.left = '0';
        loadingElement.style.top = '0';
        loadingElement.style.width = '100%';
        loadingElement.style.height = '100%';
        loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        loadingElement.style.color = 'white';
        loadingElement.style.display = 'flex';
        loadingElement.style.justifyContent = 'center';
        loadingElement.style.alignItems = 'center';
        loadingElement.style.zIndex = '9999';
        loadingElement.innerHTML = `<div class="spinner-border text-light" role="status"><span class="visually-hidden">Loading...</span></div><span style="margin-left: 15px;">${message}</span>`;
        document.body.appendChild(loadingElement);
    } else {
        loadingElement.querySelector('span:last-child').textContent = message;
        loadingElement.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingElement = document.getElementById('loadingOverlay');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

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
    console.log("[initializeForm] Starting..."); // Log start
    const form = document.getElementById('basicInfoForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); 
        });
    }

    // 动态加载岗位选项
    const positionDropdown = document.getElementById('position');
    if(positionDropdown) {
        console.log("[initializeForm] Found position dropdown.");
        let questionBank = [];
        let positions = new Set();
        try {
            const storedBank = localStorage.getItem('questionBank');
            console.log("[initializeForm] Raw questionBank from localStorage:", storedBank);
            if (!storedBank) {
                console.warn("[initializeForm] questionBank is empty or not found in localStorage.");
            } else {
                questionBank = JSON.parse(storedBank || '[]'); // Parse here
                console.log("[initializeForm] Parsed questionBank:", questionBank);

                // Iterate and extract positions
                questionBank.forEach((q, index) => {
                    if (q.position && Array.isArray(q.position)) {
                        q.position.forEach(p => {
                            if (p && p !== 'all') { // 排除 'all'
                                positions.add(p);
                            }
                        });
                    } else if (q.position && typeof q.position === 'string' && q.position !== 'all') {
                        positions.add(q.position); // 处理单个字符串岗位
                    }
                    // Optional: Log if a question doesn't contribute a valid position
                    // else { console.log(`[initializeForm] Question ${index} has no valid position:`, q.position); }
                });
                console.log("[initializeForm] Extracted unique positions:", positions);
            }
        } catch (e) {
            console.error("[initializeForm] Error parsing questionBank or extracting positions:", e);
            // Optionally clear the dropdown or show an error message to the user
            positionDropdown.innerHTML = '<option value="">加载岗位失败</option>'; 
            return; // Stop further processing if bank fails
        }

        // Clear existing options (except the first placeholder)
        while (positionDropdown.options.length > 1) {
            positionDropdown.remove(1);
        }

        // Populate dropdown
        if (positions.size === 0) {
            console.warn("[initializeForm] No valid positions found in the question bank (excluding 'all').");
            // Keep the default "请选择岗位" or add a specific message
            // positionDropdown.options[0].text = '题库中无可用岗位';
        } else {
            console.log(`[initializeForm] Populating dropdown with ${positions.size} positions...`);
            positions.forEach(pos => {
                const option = document.createElement('option');
                option.value = pos;
                option.textContent = getPositionName(pos); // Use helper function for display name
                console.log(`[initializeForm] Adding option: value='${pos}', text='${option.textContent}'`);
                positionDropdown.appendChild(option);
            });
        }

        // Add event listener and trigger initial load
        positionDropdown.removeEventListener('change', loadSections); // Remove first to prevent duplicates
        positionDropdown.addEventListener('change', loadSections);
        console.log("[initializeForm] Calling loadSections initially.");
        loadSections(); // 初始化时触发加载板块
    } else {
        console.warn("[initializeForm] Position dropdown element not found.");
    }

    // 绑定开始按钮点击事件
    const startBtn = document.getElementById('startBtn');
    if(startBtn) {
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            startAssessment();
        });
        updateStartButton(); // 确保按钮状态正确
    } else {
        console.warn("[initializeForm] Start button not found.");
    }
    console.log("[initializeForm] Finished.");
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
        updateTotalSelectedQuestionsDisplay(); // **** 更新：即使没有岗位，也更新总题数显示为0 ****
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
        updateTotalSelectedQuestionsDisplay(); // **** 更新：无板块时也更新总题数显示 ****
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
    updateTotalSelectedQuestionsDisplay(); // **** 新增：加载板块后更新总题数显示 ****
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
    updateTotalSelectedQuestionsDisplay(); // **** 新增：更新随机题数量后更新总题数显示 ****
}

// **** 新增：更新总选定题目数量显示的函数 ****
function updateTotalSelectedQuestionsDisplay() {
    // console.log("updateTotalSelectedQuestionsDisplay function called"); // <--- 注释掉日志 1
    const position = document.getElementById('position').value;
    const hintElement = document.getElementById('totalSelectedQuestionsHint');
    // console.log("Hint element:", hintElement); // <--- 注释掉日志 2

    if (!hintElement) {
        // console.error("Hint element not found!"); // <--- 注释掉错误日志
        return; // 如果元素不存在则退出
    }

    if (!position) {
        hintElement.textContent = '总题数: 0';
        // console.log("No position selected, setting text to '总题数: 0'"); // <--- 注释掉日志 3
        return;
    }

    // 获取该岗位的题目
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const positionQuestions = questionBank.filter(q =>
        q.position && (Array.isArray(q.position) ? q.position.includes(position) : q.position === position || q.position.includes('all'))
    );

    // 计算必答题数量
    const requiredCount = positionQuestions.filter(q => q.type === 'required').length;

    // 计算已选随机题数量
    let selectedRandomCount = 0;
    selectedSections.forEach(count => {
        selectedRandomCount += count;
    });

    const totalCount = requiredCount + selectedRandomCount;
    // console.log(`Calculated counts: Required=${requiredCount}, Random=${selectedRandomCount}, Total=${totalCount}`); // <--- 注释掉日志 4

    // 更新显示文本
    const newText = `本次测评总题数: ${totalCount} (必答: ${requiredCount}, 选答: ${selectedRandomCount})`;
    hintElement.textContent = newText;
    // console.log("Updated hint text to:", newText); // <--- 注释掉日志 5
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
    document.getElementById('userInfoStation').textContent = getStationName(userData.stationCode || userData.station) || '-';
    document.getElementById('userInfoPosition').textContent = userData.positionName || getPositionName(userData.positionCode || userData.position) || '-'; 
}

// 开始测评 (修改：增加本地状态检查和清除)
function startAssessment() {
    console.log("[startAssessment] Function start attempt...");
    if (!currentUser) {
        console.log("[startAssessment] User not logged in. Showing login modal.");
        alert("请先登录后再开始测评。");
        return;
    }
    console.log(`[startAssessment] User logged in: ${currentUser.id}. Proceeding...`);

    // **** 新增：检查本地是否有状态，如果开始新测评需要确认 ****
    let localState = null;
    try {
        const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedState) {
            localState = JSON.parse(storedState);
        }
    } catch (e) { /* ignore error */ }

    if (localState && (localState.status === '进行中' || localState.status === 'paused')) {
         if (!confirm('您当前有未完成或暂停的测评进度。开始新的测评将丢失之前的进度，确定要开始新的测评吗？')) {
             console.log("User cancelled starting new assessment due to existing local state.");
             return; // 用户取消
         }
         // 用户确认，清除旧状态
         console.log("User confirmed starting new assessment, clearing previous local state.");
         localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    // **** 结束检查 ****

    const assesseeNameInput = document.getElementById('name');
    const assesseeIdInput = document.getElementById('employeeId');
    const assesseeEmployeeName = assesseeNameInput?.value?.trim();
    const assesseeEmployeeId = assesseeIdInput?.value?.trim();

    if (!assesseeEmployeeId || !assesseeEmployeeName) {
        alert('请在上方表单中输入被测评人的工号和姓名。');
        if (!assesseeEmployeeName) assesseeNameInput?.focus();
        else assesseeIdInput?.focus();
        return;
    }
    console.log(`[startAssessment] Assessee Info: ID=${assesseeEmployeeId}, Name=${assesseeEmployeeName}`);

    const positionSelect = document.getElementById('position');
    const stationSelect = document.getElementById('station');
    const positionCode = positionSelect?.value;
    const positionName = positionSelect?.options[positionSelect.selectedIndex]?.text || '';
    const stationCode = stationSelect?.value;
    const stationName = stationSelect?.options[stationSelect.selectedIndex]?.text || '';

    const selectedSectionsMap = new Map();
    document.querySelectorAll('.section-count-input').forEach(input => {
         const section = input.dataset.section;
         const count = parseInt(input.value, 10) || 0;
        if (count > 0) selectedSectionsMap.set(section, count);
    });
    console.log("[startAssessment] Selected sections:", selectedSectionsMap);

    if (!positionCode || !stationCode) {
        alert('请选择您的岗位和站点。');
        return;
    }

    try { 
        let allSelectedQuestions = [];
        const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]'); 
        const requiredQuestions = questionBank.filter(q => 
             q.position && (Array.isArray(q.position) ? q.position.includes(positionCode) : q.position === positionCode || q.position.includes('all')) &&
             q.type === 'required'
        );
        allSelectedQuestions = allSelectedQuestions.concat(requiredQuestions);
        console.log(`[startAssessment] Found ${requiredQuestions.length} required questions.`);
        selectedSectionsMap.forEach((count, section) => {
            const sectionRandomQuestions = questionBank.filter(q =>
                q.position && (Array.isArray(q.position) ? q.position.includes(positionCode) : q.position === positionCode || q.position.includes('all')) &&
                q.section === section &&
                q.type === 'random'
            );
            const randomSubset = getRandomQuestions(sectionRandomQuestions, count);
            allSelectedQuestions = allSelectedQuestions.concat(randomSubset);
        });
        if (allSelectedQuestions.length === 0) {
             console.error("[startAssessment] 最终选出的题目列表为空。");
             alert("错误：未能根据您的选择组合出题目列表。");
            return;
        }
        currentQuestions = allSelectedQuestions; 
        console.log(`[startAssessment] Final total questions: ${currentQuestions.length}`);
        
        userAnswers = {};
        currentQuestions.forEach(question => {
            userAnswers[question.id] = { score: null, comment: '', startTime: null, duration: 0 };
        });
        
        currentAssessmentData = {
            objectId: null,
            assessmentId: generateFrontendId(), // 使用前端生成的数字ID
            employeeId: assesseeEmployeeId,
            employeeName: assesseeEmployeeName,
            positionCode: positionCode,
            positionName: positionName,
            stationCode: stationCode,
            stationName: stationName,
            startTime: new Date().toISOString(), // 使用 ISO 格式字符串
            status: '进行中', // 明确状态
            questions: currentQuestions.map(q => ({ 
                id: q.id, standardScore: q.standardScore, content: q.content, section: q.section, type: q.type
            })),
            answers: userAnswers,
            totalScore: null, 
            scoreRate: null, 
            totalActiveSeconds: 0, // 初始化总用时
            assessor: null,
            currentQuestionIndex: 0 // 初始化当前题目索引
        };
        console.log("[startAssessment] Initial assessment data created locally.");

        currentQuestionIndex = 0;
        document.getElementById('userInfoForm')?.classList.add('d-none');
        document.getElementById('assessmentArea')?.classList.remove('d-none');
        displayUserInfo({
            name: currentAssessmentData.employeeName,
            employeeId: currentAssessmentData.employeeId,
            stationCode: currentAssessmentData.stationCode,
            positionCode: currentAssessmentData.positionCode,
            positionName: currentAssessmentData.positionName
        });
        generateQuestionNavigation(); 
        displayCurrentQuestion(); 
        // currentSessionStartTime = new Date(); // startTimer 会设置
        startTimer(new Date(), 0); // 开始新计时，初始用时为0
        console.log("[startAssessment] Assessment interface shown.");

        // **** 开始测评时，保存一次初始状态 ****
        saveStateToLocalStorage();

    } catch (error) { 
        console.error("[startAssessment] 开始测评时发生错误:", error);
        alert(`开始测评失败: ${error.message}`); 
        document.getElementById('userInfoForm')?.classList.remove('d-none');
        document.getElementById('assessmentArea')?.classList.add('d-none');    
    }
}

// 获取随机题目
function getRandomQuestions(questions, count) {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// 更新显示题目 (修改：调用保存状态)
function displayCurrentQuestion() {
    // **** 添加详细日志 ****
    console.log("[displayCurrentQuestion] Called for index:", currentQuestionIndex);
    if (currentQuestionIndex < 0 || currentQuestionIndex >= currentQuestions.length) {
        console.error("[displayCurrentQuestion] Invalid question index:", currentQuestionIndex);
        return; 
    }
    const question = currentQuestions[currentQuestionIndex];
    console.log("[displayCurrentQuestion] Question data:", JSON.parse(JSON.stringify(question))); // Log question data

    // 使用 HTML 中实际存在的 ID
    const progressElement = document.getElementById('currentQuestionNumber'); 
    const questionContentElement = document.getElementById('questionContentText'); 
    const standardAnswerElement = document.getElementById('standardAnswerText'); 
    const scoreInputElement = document.getElementById('scoreInput');
    const commentInputElement = document.getElementById('commentInput');
    const standardScoreDisplayElement = document.getElementById('standardScoreDisplay'); // Get score display element
    
    // 更新检查，只检查核心元素
    if (!progressElement || !questionContentElement || !standardAnswerElement || !scoreInputElement || !commentInputElement || !standardScoreDisplayElement) {
        console.error("[displayCurrentQuestion] Critical UI elements (progress, content, score display, score input, comment) are missing or have incorrect IDs.");
        return; 
    }
    console.log("[displayCurrentQuestion] All critical elements found. Proceeding to update UI.");

    // 更新进度显示格式
    const progressText = `第 ${currentQuestionIndex + 1} 题 (共 ${currentQuestions.length} 题)`;
    console.log("[displayCurrentQuestion] Updating progress to:", progressText);
    progressElement.textContent = progressText; 
    
    console.log("[displayCurrentQuestion] Updating question content to:", question.content);
    questionContentElement.textContent = question.content; // 直接设置文本内容
    
    // **** 为标准答案元素添加 preserve-newlines 类 ****
    const formattedAnswer = formatAnswerContent(question.standardAnswer);
    console.log("[displayCurrentQuestion] Updating standard answer to (formatted):", formattedAnswer);
    standardAnswerElement.innerHTML = formattedAnswer; // 使用 innerHTML 以渲染可能的 HTML
    standardAnswerElement.classList.add('preserve-newlines');

    const standardScoreText = question.standardScore !== null ? question.standardScore : 'N/A';
    console.log("[displayCurrentQuestion] Updating standard score display to:", standardScoreText);
    standardScoreDisplayElement.textContent = standardScoreText; // Display standard score

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

    // **** 修改：为固定的输入框添加/更新事件监听器 (如果需要实时保存) ****
    scoreInputElement.oninput = () => { saveCurrentAnswer(false); saveStateToLocalStorage(); }; // 添加 saveStateToLocalStorage
    commentInputElement.oninput = () => { saveCurrentAnswer(false); saveStateToLocalStorage(); }; // 添加 saveStateToLocalStorage

    // 更新导航按钮状态
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    document.getElementById('nextBtn').disabled = currentQuestionIndex === currentQuestions.length - 1;
    document.getElementById('submitBtn').disabled = !checkAllAnswered(); 

    updateProgressAndStatus();
    updateQuestionNavigation();

    scoreInputElement.focus(); 
}

// **** 新增辅助函数：检查是否所有题目都已回答 ****
function checkAllAnswered() {
    console.log("[checkAllAnswered] 开始检查..."); // <--- 添加日志
    if (!currentQuestions || currentQuestions.length === 0) {
        console.log("[checkAllAnswered] 没有题目，返回 false"); // <--- 添加日志
        return false; // 没有题目不能算完成
    }
    const result = currentQuestions.every((question, index) => { // <--- 添加 index 用于调试
        const answer = userAnswers[question.id];
        // 认为有效回答是 score 不为 null 且为数字
        const isAnswered = answer && answer.score !== null && !isNaN(answer.score);
        if (!isAnswered) { // <--- 添加日志
            console.log(`[checkAllAnswered] 第 ${index + 1} 题 (ID: ${question.id}) 未评分或分数无效:`, answer?.score);
        }
        return isAnswered;
    });
    console.log("[checkAllAnswered] 检查完成，所有题目是否都已评分:", result); // <--- 添加日志
    return result;
}

// 保存当前答案 (恢复完整逻辑)
function saveCurrentAnswer(isNavigating = false) { 
    console.log(`[saveCurrentAnswer] Called. isNavigating=${isNavigating}, currentQuestionIndex=${currentQuestionIndex}, currentQuestions.length=${currentQuestions?.length}`);

    // **** 添加健壮性检查 ****
    if (!currentQuestions || currentQuestions.length === 0) {
        console.error("[saveCurrentAnswer] Error: currentQuestions is empty or not loaded.");
        return; 
    }
    if (currentQuestionIndex < 0 || currentQuestionIndex >= currentQuestions.length) {
        console.error(`[saveCurrentAnswer] Error: Invalid currentQuestionIndex: ${currentQuestionIndex}. Max index is ${currentQuestions.length - 1}`);
        return; 
    }
    // **** 检查结束 ****

    // **** 获取输入元素 ****
    const scoreInput = document.getElementById('scoreInput');
    const commentInput = document.getElementById('commentInput'); // << 定义 commentInput
    if (!scoreInput || !commentInput) { // 检查元素是否存在
        console.error("[saveCurrentAnswer] Error: scoreInput or commentInput element not found.");
        return;
    }

    // **** 获取当前题目信息 ****
    const currentQuestion = currentQuestions[currentQuestionIndex];
    const questionId = currentQuestion.id; // << 定义 questionId
    const standardScore = currentQuestion.standardScore;

    // **** 获取用户输入 ****
    const score = scoreInput.value !== '' ? parseFloat(scoreInput.value) : null;
    const comment = commentInput.value;

    // **** 验证分数 ****
    // 如果正在导航，则允许保存 null 分数而无需验证
    let scoreToSave = score;
    if (score !== null) { // Only validate if a score was entered
        if (isNaN(score) || score < 0 || (standardScore !== null && score > standardScore)) {
            if (!isNavigating) { // Only alert if not navigating away
                 alert(`请输入有效的得分 (0 到 ${standardScore !== null ? standardScore : '最大值'})。`);
                 scoreInput.focus();
                 // 对于无效分数，不保存，让用户修正
                 // 或者可以考虑保存为 null?
                 // 当前逻辑：不保存无效分数（除非是导航时输入的null）
                 return; // 阻止进一步执行，用户需要修正
            } else {
                // 如果在导航时分数无效，为了能离开，保存为 null
                console.warn("Invalid score entered while navigating. Saving as null.");
                scoreToSave = null;
            }
        }
    }

    // **** 更新 userAnswers ****
    if (!userAnswers[questionId]) { // 确保答案对象存在
         userAnswers[questionId] = { score: null, comment: '', startTime: null, duration: 0 };
    }
    userAnswers[questionId].score = scoreToSave;
    userAnswers[questionId].comment = comment;
    console.log(`[saveCurrentAnswer] Saved answer for question ${questionId}:`, userAnswers[questionId]);

    // 实时更新进度和提交按钮状态
    updateProgressAndStatus();
    updateSubmitButton(); 
    updateQuestionNavigation();
    
    // 不在此处调用 saveStateToLocalStorage()，由调用者决定
}

// 记录上一题的用时 (在切换或提交时调用)
function recordPreviousQuestionTime() {
     console.log(`[recordPreviousQuestionTime] Called. currentQuestionIndex=${currentQuestionIndex}`); // 添加日志
     // Check if we came from a valid index
     if (currentQuestionIndex >= 0 && currentQuestionIndex < currentQuestions.length) {
         console.log(`[recordPreviousQuestionTime] Accessing currentQuestions[${currentQuestionIndex}]`); // 添加日志
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

// 显示下一题 (修改：调用保存状态)
function showNextQuestion() {
    console.log(`[showNextQuestion] Clicked! currentQuestionIndex=${currentQuestionIndex}, currentQuestions.length=${currentQuestions?.length}`); // Log function entry
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn && nextBtn.disabled) {
        console.log("[showNextQuestion] Button is disabled. Aborting.");
        return; // Exit if button is disabled
    }

    if (currentQuestionIndex < currentQuestions.length - 1) {
        console.log("[showNextQuestion] Condition met: currentQuestionIndex < currentQuestions.length - 1. Proceeding...");
        saveCurrentAnswer(true); 
        recordPreviousQuestionTime();
        currentQuestionIndex++;
        console.log(`[showNextQuestion] Index incremented to: ${currentQuestionIndex}`);
        console.log("[showNextQuestion] Calling displayCurrentQuestion...");
        displayCurrentQuestion();
        console.log("[showNextQuestion] Calling saveStateToLocalStorage...");
        saveStateToLocalStorage(); // **** 切换题目后保存状态 ****
        console.log("[showNextQuestion] Navigation completed.");
    } else {
        console.log("[showNextQuestion] Condition NOT met: Already at the last question or invalid state.");
    }
}

// 显示上一题 (修改：调用保存状态)
function showPreviousQuestion() {
    console.log(`[showPreviousQuestion] Called. Before decrement: currentQuestionIndex=${currentQuestionIndex}`);
    if (currentQuestionIndex > 0) {
         saveCurrentAnswer(true);
        recordPreviousQuestionTime(); 
        currentQuestionIndex--;
        console.log(`[showPreviousQuestion] After decrement: currentQuestionIndex=${currentQuestionIndex}`);
        displayCurrentQuestion();
        saveStateToLocalStorage(); // **** 切换题目后保存状态 ****
    } else {
         console.log("[showPreviousQuestion] Already at the first question.");
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
async function submitAssessment() {
    console.log("[submitAssessment] Function start...");
    if (!currentUser) {
        // 这里理论上不应该发生，因为开始就需要登录，但做个检查
        alert("错误：用户未登录。");
        showLoginModal(); // 提示登录
        return;
    }
    // ... (获取 assessorName)
    const assessorName = prompt("请输入测评人姓名：");
    if (assessorName === null || assessorName.trim() === "") {
        alert("测评人姓名不能为空，提交已取消。");
        return;
    }
    if (!currentAssessmentData) {
        console.error("[submitAssessment] currentAssessmentData 为空，无法提交。");
        alert("发生错误：找不到当前测评数据。");
        return;
    }
    currentAssessmentData.assessor = assessorName.trim();
    // ... (保存最后一题答案和时间)
    saveCurrentAnswer(false);
    recordPreviousQuestionTime();
    // ... (检查是否所有题目已评分)
    if (!checkAllAnswered()) {
        alert('您有未评分的题目，请完成后再提交。');
        return;
    }
    // ... (计算最终分数、时长等)
    const assessmentEndTime = new Date();
    let totalScore = 0;
    let maxPossibleScore = 0;
    currentAssessmentData.questions.forEach(question => {
        const answer = userAnswers[question.id];
        const standardScore = question.standardScore || 0;
        maxPossibleScore += standardScore;
        totalScore += (answer && typeof answer.score === 'number') ? answer.score : 0;
        if (answer && (answer.duration === undefined || answer.duration === null)) {
             answer.duration = 0;
        }
    });
    const initialTotalActiveSeconds = currentAssessmentData.totalActiveSeconds || 0;
    let finalSessionDurationSeconds = 0;
    if (currentSessionStartTime) {
        finalSessionDurationSeconds = Math.floor((assessmentEndTime - currentSessionStartTime) / 1000);
    } else {
        console.warn("提交时 currentSessionStartTime 为空，最后会话时长计为0。");
    }
    stopTimer();
    let totalActiveSeconds = initialTotalActiveSeconds + finalSessionDurationSeconds;
    const scoreRate = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    currentAssessmentData.answers = userAnswers;
    currentAssessmentData.score = totalScore;
    currentAssessmentData.maxScore = maxPossibleScore;
    currentAssessmentData.scoreRate = scoreRate;
    currentAssessmentData.duration = Math.round(totalActiveSeconds / 60);
    currentAssessmentData.status = 'completed';
    currentAssessmentData.timestamp = assessmentEndTime.toISOString();
    currentAssessmentData.totalActiveSeconds = totalActiveSeconds;

    console.log("[submitAssessment] Calling submitAssessmentCloud...");
    showLoading("正在提交测评结果...");
    try {
        const dataToSend = { ...currentAssessmentData };
        delete dataToSend.owner;
        console.log("[submitAssessment] Data being sent to submitAssessmentCloud:", JSON.stringify(dataToSend, null, 2));
        console.log("[submitAssessment] Value of assessmentId (frontend ID) being sent:", dataToSend.assessmentId);
        console.log("[submitAssessment] Value of employeeId being sent:", dataToSend.employeeId);

        const savedObjectId = await AV.Cloud.run('submitAssessmentCloud', { 
            assessmentData: dataToSend,
            assessmentObjectId: currentAssessmentData.objectId 
        });
        console.log(`[submitAssessment] Cloud function successful. Returned ObjectId: ${savedObjectId}`);
        
        // **** 成功提交后清除本地状态 ****
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        console.log("Local assessment state cleared after successful submission.");

        currentAssessmentData = null; 
        window.location.href = `result.html?assessmentId=${savedObjectId}`;
    } catch (error) {
        hideLoading();
        console.error('[submitAssessment] Error calling submitAssessmentCloud:', error);
        alert("提交测评失败: " + error.message);
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.disabled = false;
        // **** 提交失败时，重新保存一下当前状态到本地 ****
        saveStateToLocalStorage(); 
    }
}

// **** 修改：暂存测评 ****
async function pauseAssessment() {
    console.log(`[pauseAssessment] Function start...`);
     if (!currentUser) {
        alert("错误：用户未登录。");
        showLoginModal();
        return;
    }
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) { /* 禁用按钮 */ pauseBtn.disabled = true; pauseBtn.innerHTML = '...'; }
    showLoading("正在暂存测评进度...");

    if (!currentAssessmentData) {
        console.error("无法暂存：没有当前的测评数据。");
        alert("没有正在进行的测评可以暂存。");
        hideLoading();
        if (pauseBtn) { /* 恢复按钮 */ pauseBtn.disabled = false; pauseBtn.innerHTML = '...'; }
        return;
    }
    
    // ... (保存当前答案和时间)
    saveCurrentAnswer(true);
    recordPreviousQuestionTime();
    // ... (计算当前会话时长和总时长)
    let currentSessionDurationSeconds = 0;
    if (currentSessionStartTime) currentSessionDurationSeconds = Math.floor((new Date() - currentSessionStartTime) / 1000);
    stopTimer();
    currentAssessmentData.totalActiveSeconds = (currentAssessmentData.totalActiveSeconds || 0) + currentSessionDurationSeconds;
    let elapsedSeconds = 0;
    if (currentAssessmentData.assessmentDate) elapsedSeconds = Math.floor((new Date() - new Date(currentAssessmentData.assessmentDate)) / 1000);
    // ... (更新本地 currentAssessmentData 状态)
    currentAssessmentData.status = 'paused';
    currentAssessmentData.elapsedSeconds = elapsedSeconds;
    currentAssessmentData.currentQuestionIndex = currentQuestionIndex; 
    currentAssessmentData.timestamp = new Date().toISOString();

    try {
        console.log("[pauseAssessment] Calling pauseAssessmentCloud...");
        const dataToSend = { ...currentAssessmentData };
        delete dataToSend.owner;

        // **** 暂存时，确保本地状态也保存一次最新的 paused 状态 ****
        saveStateToLocalStorage(); 

        const savedObjectId = await AV.Cloud.run('pauseAssessmentCloud', { 
            assessmentData: dataToSend,
            assessmentObjectId: currentAssessmentData.objectId
        });
        currentAssessmentData.objectId = savedObjectId;
        console.log(`[pauseAssessment] Pause successful. New/Updated ObjectId: ${savedObjectId}`);

        // **** 暂存成功后，可以选择清除本地状态，或者保留以备网络问题 ****
        // **** 这里选择保留本地状态，让下次加载时用户确认 ****
        // localStorage.removeItem(LOCAL_STORAGE_KEY);
        console.log("Local assessment state kept after successful pause.");

        currentAssessmentData = null;
        hideLoading();
        alert("测评已暂存。");
        window.location.href = 'index.html';

    } catch (error) {
        hideLoading();
        console.error('[pauseAssessment] Error calling pauseAssessmentCloud:', error);
        alert("暂存测评失败: " + error.message + "\n请稍后重试。");
        // 恢复按钮状态
        if (pauseBtn) { pauseBtn.disabled = false; pauseBtn.innerHTML = '...'; }
        // 重新启动计时器
        if (currentAssessmentData && currentAssessmentData.startTime) { // 使用 startTime 恢复
             startTimer(new Date(currentAssessmentData.startTime), currentAssessmentData.totalActiveSeconds || 0);
        } 
        // **** 暂存失败时，确保本地状态是最新的 (因为 pauseAssessment 修改了 status) ****
        saveStateToLocalStorage();
    }
}

// 启动计时器 (修改：使用 totalActiveSeconds 恢复)
function startTimer(startTime, initialTotalActiveSeconds = 0) {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    const timerElement = document.getElementById('timer');
    let totalSeconds = initialTotalActiveSeconds; 

    // Immediately update timer display with initial time
    const initialMinutes = Math.floor(totalSeconds / 60);
    const initialSeconds = totalSeconds % 60;
    timerElement.textContent = `${String(initialMinutes).padStart(2, '0')}:${String(initialSeconds).padStart(2, '0')}`;

    currentSessionStartTime = new Date(); // 记录当前会话开始时间，用于增量计算

    timerInterval = setInterval(() => {
        totalSeconds++; 
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        // **** 定时保存状态 (例如每分钟) ****
        if (totalSeconds % 60 === 0) { 
            saveStateToLocalStorage();
        }
    }, 1000);
}

// 停止计时器 (修改：累加最后一段会话时长)
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    // **** 停止计时器时，计算并累加最后一段会话时长 ****
    if (currentAssessmentData && currentSessionStartTime) {
         let finalSessionDurationSeconds = Math.floor((new Date() - currentSessionStartTime) / 1000);
         currentAssessmentData.totalActiveSeconds = (currentAssessmentData.totalActiveSeconds || 0) + finalSessionDurationSeconds;
         console.log(`Timer stopped. Added ${finalSessionDurationSeconds}s to totalActiveSeconds. New total: ${currentAssessmentData.totalActiveSeconds}`);
         // 不需要在这里保存到 localStorage，调用 stopTimer 的地方 (submit/pause) 会处理保存
    }
    currentSessionStartTime = null; // 清空会话开始时间
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
    console.log(`[showQuestion] Called with index=${index}. currentQuestionIndex was ${currentQuestionIndex}, currentQuestions.length=${currentQuestions?.length}`); // 添加日志
    // 验证 index 的有效性
    console.log(`[showQuestion] Validating index ${index} against length ${currentQuestions?.length}`); // 添加日志
    if (index < 0 || index >= currentQuestions.length) {
        console.error(`[showQuestion] 无效的题目索引: ${index} (总题目数: ${currentQuestions.length})`); // 添加错误日志
        alert(`内部错误：无效的题目索引 ${index}。`); // 可以给用户更友好的提示
        return;
    }
    // 更新当前题目索引
    currentQuestionIndex = index;
    console.log(`[showQuestion] currentQuestionIndex updated to: ${currentQuestionIndex}`); // 添加日志
    displayCurrentQuestion();
    console.log(`[showQuestion] Successfully switched to question index ${currentQuestionIndex}`); // 添加日志
}

// **** 辅助函数：生成唯一ID (修改为返回数字) ****
function generateFrontendId() {
    return Date.now(); // **** 返回毫秒时间戳 (数字) ****
}

// **** 移除 pagehide 事件监听器，改用 beforeunload ****
// window.addEventListener('pagehide', function(event) { ... }); 