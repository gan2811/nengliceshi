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
        try { // **** 添加 try...catch 包裹 JSON 解析和恢复逻辑 ****
            currentAssessmentData = JSON.parse(savedAssessment);
            
            // **** 健壮性检查：确保核心数据存在 ****
            if (!currentAssessmentData || !currentAssessmentData.questions || !currentAssessmentData.answers) {
                console.error("[Resume] Invalid or incomplete saved assessment data.", currentAssessmentData);
                localStorage.removeItem('currentAssessment'); // 清除无效数据
                throw new Error("Saved assessment data is invalid."); // 抛出错误，阻止后续恢复
            }

            currentQuestions = currentAssessmentData.questions;
            userAnswers = currentAssessmentData.answers;
            let loadedIndex = currentAssessmentData.currentQuestionIndex !== undefined ? currentAssessmentData.currentQuestionIndex : 0;

            // **** 关键：验证加载的索引 ****
            if (loadedIndex < 0 || loadedIndex >= currentQuestions.length) {
                console.warn(`[Resume] Invalid saved currentQuestionIndex (${loadedIndex}) for ${currentQuestions.length} questions. Resetting to 0.`);
                loadedIndex = 0; // 如果索引无效，重置为 0
                // 可选：也可以重置为最后一题 currentQuestions.length - 1
            }
            currentQuestionIndex = loadedIndex; // 使用验证或重置后的索引
            
            // **** 确保加载累计的活动时间 ****
            currentAssessmentData.totalActiveSeconds = currentAssessmentData.totalActiveSeconds || 0; // 确保该字段存在并初始化
            
            // **** 调用 displayUserInfo 显示信息 ****
            if(currentAssessmentData.userInfo) { // 检查 userInfo 是否存在
               displayUserInfo(currentAssessmentData.userInfo);
            } else {
                console.warn("[Resume] userInfo not found in saved data.");
                // 可以考虑根据 employeeId 等信息重新获取
            }

            // 隐藏信息表单，显示测评区域
            const userInfoForm = document.getElementById('userInfoForm'); // 假设 setup 页面的 ID
            const assessmentArea = document.getElementById('assessmentArea'); // 假设测评界面的 ID
            if (userInfoForm) userInfoForm.classList.add('d-none');
            if (assessmentArea) assessmentArea.classList.remove('d-none');
            
            // 恢复计时器状态 (显示总流逝时间)
            if (currentAssessmentData.startTime) { // 检查 startTime 是否存在
                const assessmentStartTime = new Date(currentAssessmentData.startTime);
                const elapsedSeconds = currentAssessmentData.elapsedSeconds || 0; // 这是总流逝时间
                startTimer(assessmentStartTime, elapsedSeconds); 
            } else {
                 console.warn("[Resume] startTime not found in saved data. Cannot resume timer accurately.");
                 // 可以考虑启动一个新计时器，或者不启动
            }

            // 生成导航并显示当前题目
            generateQuestionNavigation(); // Generate buttons first
            showQuestion(currentQuestionIndex); // Then show the correct question
            updateProgressAndStatus(); // Update counts
            updateSubmitButton(); // Update submit button state
        
        } catch (error) {
            console.error("[Resume] Error resuming assessment from localStorage:", error);
            // 如果恢复出错，清除可能损坏的数据并显示设置界面
            localStorage.removeItem('currentAssessment');
            const userInfoForm = document.getElementById('userInfoForm');
            const assessmentArea = document.getElementById('assessmentArea');
            if (userInfoForm) userInfoForm.classList.remove('d-none');
            if (assessmentArea) assessmentArea.classList.add('d-none');
            alert("恢复之前的测评进度时出错，请重新开始。");
        }

    } else {
        // 没有正在进行的测评，显示信息表单
        const userInfoForm = document.getElementById('userInfoForm');
        const assessmentArea = document.getElementById('assessmentArea');
         if (userInfoForm) userInfoForm.classList.remove('d-none');
         if (assessmentArea) assessmentArea.classList.add('d-none');
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
    document.getElementById('userInfoStation').textContent = getStationName(userData.station) || '-';
    document.getElementById('userInfoPosition').textContent = userData.positionName || getPositionName(userData.position) || '-'; 
}

// 开始测评
function startAssessment() {
    console.log("[startAssessment] 函数开始");
    const totalQuestionsInput = document.getElementById('totalQuestionsToAsk'); 
    
    // **** 确保 try 关键字在函数体内部，包裹主要逻辑 ****
    try { 
        const name = document.getElementById('name').value;
        const employeeId = document.getElementById('employeeId').value;
        const positionSelect = document.getElementById('position');
        const stationSelect = document.getElementById('station');
        const positionCode = positionSelect.value;
        const positionName = positionSelect.options[positionSelect.selectedIndex]?.text || '';
        const stationCode = stationSelect.value;
        const stationName = stationSelect.options[stationSelect.selectedIndex]?.text || '';
        
        // **** 修正 selectedSections 获取方式，使用 data-section 属性 ****
        const selectedSectionsMap = new Map(); // 使用 Map 存储选中的 section 和数量
        document.querySelectorAll('.section-count-input').forEach(input => {
             const section = input.dataset.section;
             const count = parseInt(input.value, 10) || 0;
             if (count > 0) {
                 selectedSectionsMap.set(section, count);
             }
        });

        currentEmployeeId = employeeId;
        currentEmployeeName = name;
        currentPositionCode = positionCode;
        currentPositionName = positionName;
        currentStationCode = stationCode;
        currentStationName = stationName;
        
        // **** 使用 selectedSectionsMap 的大小判断是否有选择 ****
        if (!currentEmployeeId || !currentEmployeeName || !currentPositionCode || !currentStationCode /* || selectedSectionsMap.size === 0 */ ) { // 先不强制必须选模块
            alert('请确保姓名、工号、岗位、站点都已选择。');
            return;
        }

        // 确保 allQuestionsData 已加载 (这里假设它已在别处加载)
        if (!allQuestionsData || Object.keys(allQuestionsData).length === 0) {
            console.error("[startAssessment] 题目数据 (allQuestionsData) 未加载。");
            alert("错误：无法加载题目数据，请刷新页面或联系管理员。");
            return;
        }
        
        // **** 修正：根据 selectedSectionsMap 确定哪些模块被选中，并获取题目 ****
        let allSelectedQuestions = [];
        const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]'); // 假设从 localStorage 获取
        
        // 1. 获取所有必答题
        const requiredQuestions = questionBank.filter(q => 
             q.position && (Array.isArray(q.position) ? q.position.includes(positionCode) : q.position === positionCode || q.position.includes('all')) &&
             q.type === 'required'
        );
        allSelectedQuestions = allSelectedQuestions.concat(requiredQuestions);
        console.log(`[startAssessment] Found ${requiredQuestions.length} required questions.`);

        // 2. 根据 selectedSectionsMap 获取选答题
        selectedSectionsMap.forEach((count, section) => {
            const sectionRandomQuestions = questionBank.filter(q =>
                q.position && (Array.isArray(q.position) ? q.position.includes(positionCode) : q.position === positionCode || q.position.includes('all')) &&
                q.section === section &&
                q.type === 'random'
            );
            const randomSubset = getRandomQuestions(sectionRandomQuestions, count); // 使用之前的 getRandomQuestions
            allSelectedQuestions = allSelectedQuestions.concat(randomSubset);
            console.log(`[startAssessment] Selected ${randomSubset.length} random questions from section '${section}'.`);
        });

        if (allSelectedQuestions.length === 0) {
             console.error("[startAssessment] 最终选出的题目列表为空。");
             alert("错误：未能根据您的选择组合出题目列表，请检查配置或选择。");
             return;
        }

        // **** 不再需要从 totalQuestionsInput 读取，总数由必答+选答决定 ****
        currentQuestions = allSelectedQuestions; 
        console.log(`[startAssessment] Final total questions: ${currentQuestions.length}`);
        
        userAnswers = {};
        currentQuestions.forEach(question => {
            userAnswers[question.id] = {
                score: null,
                comment: '',
                startTime: null,
                duration: 0
            };
        });
        currentAssessmentData = {
            assessmentId: generateFrontendId(), 
            employeeId: currentEmployeeId, 
            employeeName: currentEmployeeName, 
            positionCode: currentPositionCode, 
            positionName: currentPositionName,
            stationCode: currentStationCode, 
            stationName: currentStationName,
            assessmentDate: new Date().toISOString(), 
            status: '进行中',
            questions: currentQuestions.map(q => ({ 
                id: q.id, 
                standardScore: q.standardScore,
                content: q.content, 
                section: q.section, // 添加 section
                type: q.type // 添加 type
            })),
            answers: userAnswers, 
            totalScore: null,
            scoreRate: null,
            totalActiveSeconds: 0, 
            assessor: null
        };
        console.log(`[startAssessment] Questions loaded. count=${currentQuestions?.length}, currentAssessmentData initialized.`);
        currentQuestionIndex = 0; 
        console.log(`[startAssessment] Initial currentQuestionIndex set to: ${currentQuestionIndex}`);
        document.getElementById('assessmentSetup').style.display = 'none';
        document.getElementById('assessmentInterface').style.display = 'block';
        generateQuestionNavigation();
        displayCurrentQuestion(); 
        currentSessionStartTime = new Date();
        startTimer(currentSessionStartTime); 
        console.log("[startAssessment] 函数结束，测评界面已显示");

    } catch (error) { 
        console.error("[startAssessment] 开始测评时发生错误:", error);
        alert(`开始测评失败: ${error.message}`); 
        document.getElementById('assessmentSetup').style.display = 'block';
        document.getElementById('assessmentInterface').style.display = 'none';
    }
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

// **** 修改保存逻辑：允许切换题目，即使未评分 ****
function saveCurrentAnswer(isNavigating = false) { // Added isNavigating flag
    console.log(`[saveCurrentAnswer] Called. isNavigating=${isNavigating}, currentQuestionIndex=${currentQuestionIndex}, currentQuestions.length=${currentQuestions?.length}`); // 添加日志
    
    // **** 添加健壮性检查 ****
    if (!currentQuestions || currentQuestions.length === 0) {
        console.error("[saveCurrentAnswer] Error: currentQuestions is empty or not loaded.");
        // 可以考虑是否需要 alert 或其他错误处理
        return; // 提前退出，防止后续错误
    }
    if (currentQuestionIndex < 0 || currentQuestionIndex >= currentQuestions.length) {
        console.error(`[saveCurrentAnswer] Error: Invalid currentQuestionIndex: ${currentQuestionIndex}. Max index is ${currentQuestions.length - 1}`);
        // 同样，考虑错误处理
        return; // 提前退出
    }
    // **** 检查结束 ****

    const scoreInput = document.getElementById('scoreInput');
    console.log(`[saveCurrentAnswer] Accessing currentQuestions[${currentQuestionIndex}] before getting id.`); // 在访问前打印
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

// 显示下一题
function showNextQuestion() {
    console.log(`[showNextQuestion] Called. Before increment: currentQuestionIndex=${currentQuestionIndex}, totalQuestions=${currentQuestions?.length}`); // 添加日志
    if (currentQuestionIndex < currentQuestions.length - 1) {
        // **先保存当前题目答案 (允许未评分)**
        saveCurrentAnswer(true); 
        // **再记录当前题目用时**
        recordPreviousQuestionTime();
        
        // 切换到下一题
        currentQuestionIndex++;
        console.log(`[showNextQuestion] After increment: currentQuestionIndex=${currentQuestionIndex}`); // 添加日志
        displayCurrentQuestion();
    } else {
        console.log("[showNextQuestion] Already at the last question."); // 添加日志
    }
}

// 显示上一题
function showPreviousQuestion() {
    console.log(`[showPreviousQuestion] Called. Before decrement: currentQuestionIndex=${currentQuestionIndex}`); // 添加日志
    if (currentQuestionIndex > 0) {
         // **先保存当前题目答案 (允许未评分)**
         saveCurrentAnswer(true);
        // **再记录当前题目用时**
        recordPreviousQuestionTime(); 
        
        // 切换到上一题
        currentQuestionIndex--;
        console.log(`[showPreviousQuestion] After decrement: currentQuestionIndex=${currentQuestionIndex}`); // 添加日志
        displayCurrentQuestion();
    } else {
         console.log("[showPreviousQuestion] Already at the first question."); // 添加日志
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

// **** 修改：提交测评 (调用云函数) ****
async function submitAssessment() {
    console.log("[submitAssessment] 函数开始执行 (云函数版)");

    // 获取测评人姓名 (逻辑不变)
    const assessorName = prompt("请输入测评人姓名：");
    if (assessorName === null || assessorName.trim() === "") {
        alert("测评人姓名不能为空，提交已取消。");
        console.log("[submitAssessment] 测评人姓名为空或取消，函数返回");
        return;
    }
    console.log("[submitAssessment] 获取到测评人姓名:", assessorName);
    // 确保 currentAssessmentData 存在
    if (!currentAssessmentData) {
        console.error("[submitAssessment] currentAssessmentData 为空，无法提交。");
        alert("发生错误：找不到当前测评数据。");
        return;
    }
    currentAssessmentData.assessor = assessorName.trim();

    // 保存最后一题答案和时间 (逻辑不变)
    saveCurrentAnswer(false);
    recordPreviousQuestionTime();

    // 检查所有题目是否都已评分 (逻辑不变)
    const allAnswered = checkAllAnswered();
    console.log("[submitAssessment] checkAllAnswered() 返回:", allAnswered);
    if (!allAnswered) {
        alert('您有未评分的题目，请完成后再提交。');
        console.log("[submitAssessment] 存在未评分题目，函数返回");
        return;
    }

    // 计算分数、时长等最终数据 (逻辑不变)
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

    // 更新 currentAssessmentData 用于传递给云函数
    currentAssessmentData.answers = userAnswers;
    currentAssessmentData.score = totalScore;
    currentAssessmentData.maxScore = maxPossibleScore;
    currentAssessmentData.scoreRate = scoreRate;
    currentAssessmentData.duration = Math.round(totalActiveSeconds / 60); // 仍然计算，云函数也会计算
    currentAssessmentData.status = 'completed'; // 标记为完成
    currentAssessmentData.timestamp = assessmentEndTime.toISOString(); // 完成时间戳
    currentAssessmentData.totalActiveSeconds = totalActiveSeconds;

    console.log("[submitAssessment] 准备调用云函数 submitAssessmentCloud...");
    console.log("[submitAssessment] 传递的数据包预览:", JSON.parse(JSON.stringify(currentAssessmentData))); // 打印数据包快照

    // **** 调用云函数 ****
    try {
        // 显示加载状态 (可选)
        const submitBtn = document.getElementById('submitBtn');
        if(submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 提交中...';
        }

        const savedAssessmentObjectId = await AV.Cloud.run('submitAssessmentCloud', { assessmentData: currentAssessmentData });

        console.log("[submitAssessment] 云函数调用成功，返回 Assessment ObjectId:", savedAssessmentObjectId);

        // **[成功处理] 清除本地存储并跳转**
        // 保存到本地历史记录 (可选，因为现在主要依赖云端)
        // 如果决定不保存本地历史，可以注释掉下面几行
        const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
        const historyRecord = currentAssessmentData; // 直接使用准备好的数据
        const historyWithoutPaused = history.filter(item => !(item.id === historyRecord.id && item.status === 'paused'));
        historyWithoutPaused.push(historyRecord);
        localStorage.setItem('assessmentHistory', JSON.stringify(historyWithoutPaused));
        console.log("[submitAssessment] 结果已同步保存到本地历史记录。");

        localStorage.removeItem('currentAssessment');
        console.log("[submitAssessment] 本地 currentAssessment 已清除。准备跳转...");

        // 恢复正常的跳转逻辑
        window.location.href = `result.html?assessmentId=${savedAssessmentObjectId}`; // 使用云函数返回的 ObjectId
        
        // 移除调试代码
        // console.log(`[submitAssessment] [调试] 操作完成，页面跳转已被禁用。收到的 ObjectId: ${savedAssessmentObjectId}`);
        // alert(`[调试] 测评提交成功！页面跳转已临时禁用，请查看控制台日志中的 ObjectId: ${savedAssessmentObjectId}`);

        // 移除调试时添加的按钮状态恢复，因为页面会跳转
        // if (submitBtn) { 
        //     submitBtn.disabled = false;
        //     submitBtn.innerHTML = '提交测评 (调试模式)';
        // }

    } catch (error) {
        // **[错误处理]**
        console.error('[submitAssessment] 调用云函数时出错:', error);

        // **** 更新：标记为失败并保存回 localStorage ****
        if (currentAssessmentData) { 
            currentAssessmentData.status = 'failed_to_submit'; // 标记失败状态
            currentAssessmentData.errorInfo = { // 可选：记录错误信息
                code: error.code,
                message: error.message,
                timestamp: new Date().toISOString()
            };
            try {
                // 1. 仍然保存到 currentAssessment，以便下次进入测评页时可以提示
                localStorage.setItem('currentAssessment', JSON.stringify(currentAssessmentData));
                console.log("[submitAssessment] 已将失败状态保存回 localStorage ('currentAssessment')，ID:", currentAssessmentData.id);
                
                // 2. 同时添加到/更新到 assessmentHistory
                const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
                const existingIndex = history.findIndex(item => item.id === currentAssessmentData.id);
                if (existingIndex > -1) {
                    history[existingIndex] = { ...currentAssessmentData }; // 更新历史记录中的对应项
                    console.log(`[submitAssessment] 已更新 assessmentHistory 中的失败记录，ID: ${currentAssessmentData.id}`);
                } else {
                    history.push({ ...currentAssessmentData }); // 添加为新的失败记录
                     console.log(`[submitAssessment] 已将新的失败记录添加到 assessmentHistory，ID: ${currentAssessmentData.id}`);
                }
                localStorage.setItem('assessmentHistory', JSON.stringify(history));

            } catch (saveError) {
                console.error("[submitAssessment] 保存失败状态到 localStorage 时出错:", saveError);
            }
        } else {
            console.error("[submitAssessment] 无法保存失败状态，currentAssessmentData 不存在。");
        }
        // **** 结束更新 ****

        let errorMessage = '测评结果提交到云端失败！';
        if (error.code && error.message) {
            errorMessage += `\n错误 (${error.code}): ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage += `\n详情: ${error}`;
        }
        errorMessage += '\n\n您的测评进度已保存在本地，请稍后在"历史记录"页面检查并尝试重新提交。'; // 修改提示
        alert(errorMessage);

        // 在 catch 块中也恢复按钮状态
        const submitBtn = document.getElementById('submitBtn'); // 确保 submitBtn 在此处可用
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '提交失败 (重试)'; // 更新按钮文本提示重试
        }
    }
}

// **** 修改：暂存测评 (增加云端同步) ****
async function pauseAssessment() { // <-- Make the function async
    console.log(`[pauseAssessment] Function start. currentQuestionIndex=${currentQuestionIndex}, currentQuestions.length=${currentQuestions?.length}`); // 添加日志
    // 0. 禁用按钮，显示加载状态
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.disabled = true;
        pauseBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 暂存中...';
    }

    // 1. 记录当前状态
    if (!currentAssessmentData) {
        console.error("无法暂存：没有当前的测评数据。");
        alert("没有正在进行的测评可以暂存。");
        if (pauseBtn) { // Re-enable button on early exit
            pauseBtn.disabled = false;
            pauseBtn.innerHTML = '<i class="bi bi-pause-circle me-1"></i> 暂存测评';
        }
        return;
    }
    
    // **** 保存最后一次答案和时间 ****
    console.log(`[pauseAssessment] Calling saveCurrentAnswer(true). currentQuestionIndex=${currentQuestionIndex}`); // 添加日志
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

    // 3. 更新测评数据状态 (本地副本)
    currentAssessmentData.status = 'paused';
    currentAssessmentData.elapsedSeconds = elapsedSeconds; // 保存总流逝时间
    currentAssessmentData.currentQuestionIndex = currentQuestionIndex; 
    currentAssessmentData.timestamp = new Date().toISOString(); // 更新时间戳为暂存时间
    // totalActiveSeconds 已经在上面更新过了

    // **** 新增：调用云函数保存暂停状态 ****
    let cloudSaveSuccess = false;
    try {
        console.log("[pauseAssessment] Calling pauseAssessmentCloud cloud function...");
        const cloudResultId = await AV.Cloud.run('pauseAssessmentCloud', { assessmentData: currentAssessmentData });
        console.log("[pauseAssessment] Cloud function call successful. Returned ObjectId:", cloudResultId);
        // 可选：如果云端保存成功，可以更新本地数据的 ID 为云端返回的 objectId，但这可能引起混淆，暂时不修改
        // currentAssessmentData.cloudObjectId = cloudResultId; // 示例：添加云端ID
        cloudSaveSuccess = true;
    } catch (error) {
        console.error('[pauseAssessment] 调用云函数 pauseAssessmentCloud 时出错:', error);
        let errorMessage = '将暂停状态同步到云端失败！';
        if (error.code && error.message) {
            errorMessage += `\n错误 (${error.code}): ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage += `\n详情: ${error}`;
        }
        errorMessage += '\n\n测评进度仍会保存在本地。';
        alert(errorMessage);
        // 即使云端失败，也继续本地保存
    }
    // **** 云函数调用结束 ****

    // 4. 保存到本地历史记录 (无论云端是否成功，都保存本地)
    console.log("[pauseAssessment] Saving state to local storage history...");
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    // 使用更新过的 currentAssessmentData 创建历史记录
     const historyRecord = {
        id: currentAssessmentData.id, // Keep original frontend ID for local consistency
        userInfo: currentAssessmentData.userInfo, 
        position: currentAssessmentData.position,
        assessor: currentAssessmentData.assessor || null,
        timestamp: currentAssessmentData.timestamp, // Use pause time
        startTime: currentAssessmentData.startTime,
        duration: Math.round((currentAssessmentData.totalActiveSeconds || 0) / 60),
        score: { totalScore: null, maxScore: currentAssessmentData.maxScore || null, scoreRate: null },
        questions: currentAssessmentData.questions,
        answers: currentAssessmentData.answers,
        status: 'paused', // Always paused for this function
        elapsedSeconds: currentAssessmentData.elapsedSeconds,
        currentQuestionIndex: currentAssessmentData.currentQuestionIndex,
        totalActiveSeconds: currentAssessmentData.totalActiveSeconds,
        // cloudObjectId: currentAssessmentData.cloudObjectId || null // 可选：包含云端ID
    };

    // 检查是否已存在相同 ID 的暂停记录，如果存在则替换，否则添加
    const existingIndex = history.findIndex(item => item.id === historyRecord.id);
    if (existingIndex > -1) {
        history[existingIndex] = historyRecord; // Update existing paused record
        console.log(`[pauseAssessment] Updated existing paused record in local history (ID: ${historyRecord.id}).`);
    } else {
        history.push(historyRecord); // Add as new paused record
        console.log(`[pauseAssessment] Added new paused record to local history (ID: ${historyRecord.id}).`);
    }
    try {
    localStorage.setItem('assessmentHistory', JSON.stringify(history));
        console.log("[pauseAssessment] Local history saved successfully.");
    } catch (e) {
        console.error("[pauseAssessment] Error saving to local storage history:", e);
        alert("保存测评进度到本地历史记录失败！请检查浏览器存储空间。"
              + "\n错误: " + e.message);
        // 如果本地保存失败，恢复按钮状态并停止
        if (pauseBtn) {
            pauseBtn.disabled = false;
            pauseBtn.innerHTML = '<i class="bi bi-pause-circle me-1"></i> 暂存测评';
        }
        return;
    }


    // 5. 清除当前测评状态并重定向
    console.log("[pauseAssessment] Removing current assessment state from local storage.");
    localStorage.removeItem('currentAssessment');

    // 根据云端保存结果显示不同提示
    if (cloudSaveSuccess) {
        alert("测评已暂存到本地和云端！");
    } else {
        alert("测评已暂存到本地（云端同步失败）。");
    }

    console.log("[pauseAssessment] Redirecting to history.html...");
    window.location.href = 'history.html'; // Redirect to history page

    // 注意：页面即将跳转，无需恢复按钮状态
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

// **** 新增：在页面隐藏/离开时自动保存进行中的测评状态 ****
window.addEventListener('pagehide', function(event) {
    // 检查是否有正在进行的测评数据，并且状态是 'in_progress'
    if (currentAssessmentData && currentAssessmentData.status === 'in_progress') {
        console.log('[pagehide] Detected active assessment. Preparing to save state...');

        // 1. 保存当前题目的答案和评论 (允许未评分)
        saveCurrentAnswer(true); 
        // 2. 记录当前题目的用时 (如果需要精确累计)
        recordPreviousQuestionTime(); 

        // 3. 更新 currentAssessmentData 中的关键状态
        // **** 重要：确保这里使用的是当前的全局 currentQuestionIndex ****
        currentAssessmentData.currentQuestionIndex = currentQuestionIndex; 

        // 4. 计算并更新时间
        // ... (时间计算逻辑保持不变) ...
        let currentSessionDurationSeconds = 0;
        if (currentSessionStartTime) {
            currentSessionDurationSeconds = Math.floor((new Date() - currentSessionStartTime) / 1000);
        }
        currentAssessmentData.totalActiveSeconds = (currentAssessmentData.totalActiveSeconds || 0) + currentSessionDurationSeconds;
        let elapsedSeconds = 0;
        if (currentAssessmentData.startTime) {
            const startTime = new Date(currentAssessmentData.startTime);
            const now = new Date();
            elapsedSeconds = Math.floor((now - startTime) / 1000);
        }
        currentAssessmentData.elapsedSeconds = elapsedSeconds;

        // 5. 将更新后的数据保存到 localStorage
        try {
            // **** 添加详细日志：在保存前打印关键状态 ****
            console.log(`[pagehide] --- Saving State ---`);
            console.log(`[pagehide] currentQuestionIndex to be saved: ${currentAssessmentData.currentQuestionIndex}`);
            // 确保 currentAssessmentData.questions 存在再访问 length
            const questionsLength = currentAssessmentData.questions ? currentAssessmentData.questions.length : 'undefined';
            console.log(`[pagehide] currentQuestions.length to be saved: ${questionsLength}`);
            // 可以选择性打印整个对象，但可能很大
            // console.log('[pagehide] Full data being saved:', JSON.stringify(currentAssessmentData)); 
            
            localStorage.setItem('currentAssessment', JSON.stringify(currentAssessmentData));
            console.log('[pagehide] Assessment state saved to localStorage.');
        } catch (e) {
            console.error('[pagehide] Error saving assessment state to localStorage:', e);
        }
        // 注意：这里不需要停止计时器或清除 currentSessionStartTime，因为页面即将卸载
    } else {
        console.log('[pagehide] No active assessment found or status is not in_progress. No state saved.');
    }
});
// **** 自动保存逻辑结束 ****

// 获取随机题目
function getRandomQuestions(questions, count) {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
} 