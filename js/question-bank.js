// 全局变量
let currentPage = 1;
const pageSize = 10;
let filteredQuestions = [];
let currentPosition = 'station_duty'; // 默认选中车站值班员岗位
let allPositions = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadQuestions();
    initializeEventListeners();
    setupDragAndDrop(); // **** 新增：初始化拖拽区域 ****
    setupModalReset(); // **** 新增：初始化模态框重置 ****
});

// 初始化事件监听器 (添加空值检查)
function initializeEventListeners() {
    // 搜索框输入事件
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchQuestions();
        });
    } else {
        console.warn("Search input element not found.");
    }

    // 全部岗位复选框事件 (模态框内) - 检查元素是否存在
    const positionAllCheckbox = document.getElementById('positionAll');
    if (positionAllCheckbox) { 
        positionAllCheckbox.addEventListener('change', function() {
            const positionCheckboxes = document.querySelectorAll('#questionModal .position-checkbox'); // 限定在模态框内查找
            positionCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
                checkbox.disabled = this.checked;
            });
        });
    } else {
        // 这个元素可能在之前的修改中被移除了，如果是故意的，这个警告可以忽略
        console.warn("'positionAll' checkbox element in modal not found. If removed intentionally, ignore this.");
    }

    // 单个岗位复选框事件 (模态框内) - 检查元素是否存在
    const modalPositionCheckboxes = document.querySelectorAll('#questionModal .position-checkbox'); // 使用新变量名以示区分
    if (modalPositionCheckboxes.length > 0) {
        modalPositionCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                // 重新查询以获取最新状态
                const allModalCheckboxes = document.querySelectorAll('#questionModal .position-checkbox'); 
                const allChecked = Array.from(allModalCheckboxes).every(cb => cb.checked);
                const positionAll = document.getElementById('positionAll'); 
                if(positionAll) { // 再次检查 positionAll 是否存在
                    positionAll.checked = allChecked;
                    // 如果不是全部选中，解除 positionAll 的 disabled 状态（如果它存在且被禁用）
                    if (!allChecked) {
                       positionAll.disabled = false;
                    } 
                }
            });
        });
    } else {
        console.warn("No '.position-checkbox' elements found inside #questionModal.");
    }
}

// **** 再次确保辅助函数定义在调用它们之前 ****
// 新增：获取岗位图标的辅助函数
function getPositionIcon(position) {
    // ... (内容不变) ...
    // 确保 switch 语句覆盖所有可能
    switch(String(position || '').trim()) {
        case 'duty_station': return 'bi-person-workspace';
        case 'station_duty': return 'bi-person-badge';
        case 'station_safety': return 'bi-shield-lock';
        case 'all': return 'bi-grid-fill';
        default: return 'bi-question-circle'; // Default icon
    }
}

// 新增：创建岗位按钮的辅助函数
function createPositionButton(position, text) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary position-btn';
    btn.dataset.position = position;
    btn.innerHTML = `<i class="${getPositionIcon(position)} me-1"></i>${text}`;
    btn.addEventListener('click', function() {
        filterByPosition(this.dataset.position);
    });
    return btn;
}

// 新增：更新激活的标签按钮状态 (配合新CSS)
function updateActiveTab() {
    console.log(`[Debug] updateActiveTab called. currentPosition = ${currentPosition}`);
    document.querySelectorAll('#positionTabsContainer .position-btn').forEach(btn => {
        const isActive = btn.dataset.position === currentPosition;
        console.log(`[Debug] Checking button: ${btn.dataset.position}, Is active? ${isActive}`);
        if (isActive) {
            btn.classList.add('active'); 
        } else {
            btn.classList.remove('active');
        }
    });
}

// 获取岗位名称
function getPositionName(position) {
    // 确保处理的是字符串
    const posTrimmed = String(position || '').trim(); 
    console.log(`[Debug] getPositionName received: '${position}', trimmed: '${posTrimmed}'`); // 增加日志
    switch(posTrimmed) {
        case 'duty_station': return '值班站长';
        case 'station_duty': return '车站值班员';
        case 'station_safety': return '站务安全员';
        case 'all': return '全部岗位';
        default: 
            console.warn(`[Debug] getPositionName could not match: '${posTrimmed}'`);
            return posTrimmed; // 返回原始代码作为备用
    }
}

// **** 新增：生成并保存岗位代码到名称的映射 ****
function updateAndSaveJobPositions() {
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const positionMap = {};
    questionBank.forEach(q => {
        if (q.position && Array.isArray(q.position)) {
            q.position.forEach(p => {
                if (p && p !== 'all') {
                    // 如果映射中还没有这个代码，添加它和它的名称
                    if (!positionMap[p]) {
                        positionMap[p] = getPositionName(p); // 使用 getPositionName 获取中文名
                    }
                }
            });
        }
    });
    localStorage.setItem('jobPositions', JSON.stringify(positionMap));
    console.log("Updated and saved jobPositions to localStorage:", positionMap);
}

// 加载题目列表和岗位标签
function loadQuestions() {
    const questionBankStr = localStorage.getItem('questionBank');
    console.log("[Debug] Raw questionBank from localStorage:", questionBankStr);
    const questionBank = JSON.parse(questionBankStr || '[]');
    console.log("[Debug] Parsed questionBank:", JSON.parse(JSON.stringify(questionBank))); // Log deep copy
    
    // 提取所有不重复的岗位
    const positionsSet = new Set();
    questionBank.forEach(q => {
        // **** 增加日志：检查每个题目的 position ****
        console.log(`[Debug] Checking question ID ${q.id}, position:`, q.position);
        if (q.position && Array.isArray(q.position)) {
            q.position.forEach(p => {
                if (p && typeof p === 'string') { // **** 确保添加的是非空字符串 ****
                   positionsSet.add(p.trim());
                } else {
                    console.warn(`[Debug] Invalid position value found in question ID ${q.id}:`, p);
                }
            });
        }
    });
    positionsSet.delete('all'); 
    // **** 过滤掉可能的无效值 ****
    allPositions = Array.from(positionsSet).filter(p => p).sort(); 
    console.log("[Debug] Extracted, filtered, and sorted allPositions:", allPositions);
    
    // **** 首次加载时也更新一次 jobPositions ****
    updateAndSaveJobPositions();
    
    // 动态加载岗位标签
    loadPositionTabs();
    
    filteredQuestions = questionBank;
    filterByPosition(currentPosition);
}

// 新增：动态加载岗位标签按钮
function loadPositionTabs() {
    const container = document.getElementById('positionTabsContainer');
    console.log("[Debug] loadPositionTabs: Container found?", !!container);
    if (!container) return;
    container.innerHTML = ''; 

    console.log("[Debug] loadPositionTabs: Generating tabs for positions:", allPositions);
    if (allPositions.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无按岗位分类的题库。</p>';
        return;
    }

    // 为每个实际岗位创建按钮
    allPositions.forEach(position => {
        // **** 添加日志：检查 position 和 getPositionName ****
        console.log(`[Debug] Creating button for position code: ${position}`);
        const positionName = getPositionName(position);
        console.log(`[Debug] getPositionName returned: ${positionName}`);
        const btnText = positionName ? positionName + '题库' : '未知岗位题库'; // 添加备用文本
        const btn = createPositionButton(position, btnText);
        container.appendChild(btn);
    });
    
    console.log("[Debug] loadPositionTabs: Finished appending buttons. Updating active tab...");
    updateActiveTab();
}

// 根据岗位筛选题目
function filterByPosition(position) {
    currentPosition = position;
    console.log(`[Debug] filterByPosition called with: ${position}. currentPosition set.`); // 增加日志
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    
    // **** 增加日志：检查筛选前的题库 ****
    console.log(`[Debug] Filtering from ${questionBank.length} total questions.`);

    if (position === 'all') { // 'all' 逻辑现在应该由 displayPositionTabs 处理，这里暂时保留
        filteredQuestions = questionBank;
        console.log(`[Debug] Position is 'all', filteredQuestions count: ${filteredQuestions.length}`);
    } else {
        filteredQuestions = questionBank.filter(question => {
            const hasPosition = question.position && 
                                ( (Array.isArray(question.position) && question.position.includes(position)) || 
                                  (typeof question.position === 'string' && question.position === position) ||
                                  (Array.isArray(question.position) && question.position.includes('all')) // 也考虑 all
                                );
            // **** 增加日志：检查每个题目的筛选结果 ****
            // console.log(`[Debug] Question ID ${question.id}, Position: ${question.position}, Has Position for '${position}'? ${hasPosition}`);
            return hasPosition;
        });
        console.log(`[Debug] Position is '${position}', filteredQuestions count: ${filteredQuestions.length}`);
    }
    
    currentPage = 1; // 重置页码
    displayQuestions();
    
    // **** 移除错误的旧标签状态更新代码 ****
    /* 
    document.querySelectorAll('#positionTabs .nav-link').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('onclick').includes(position)) {
            tab.classList.add('active');
        }
    });
    */
   
    // **** 添加正确的状态更新调用 ****
    updateActiveTab(); 
    console.log(`[Debug] filterByPosition finished, updateActiveTab called.`);
}

// 显示题目列表 (修改以支持分页)
function displayQuestions() {
    const requiredList = document.getElementById('requiredQuestionsList');
    const randomList = document.getElementById('randomQuestionsList');
    requiredList.innerHTML = '';
    randomList.innerHTML = '';

    // **** 分页逻辑 ****
    const totalItems = filteredQuestions.length;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const questionsToDisplay = filteredQuestions.slice(start, end);

    // **** 基于当前页的题目进行分类 ****
    const requiredQuestionsOnPage = questionsToDisplay.filter(q => q.type === 'required');
    const randomQuestionsOnPage = questionsToDisplay.filter(q => q.type === 'random');

    // **** 更新总计数（基于所有筛选结果） ****
    const totalRequiredCount = filteredQuestions.filter(q => q.type === 'required').length;
    const totalRandomCount = filteredQuestions.filter(q => q.type === 'random').length;
    document.getElementById('requiredCount').textContent = totalRequiredCount;
    document.getElementById('randomCount').textContent = totalRandomCount;
    
    // 显示必答题 (当前页)
    if (totalRequiredCount === 0) {
        requiredList.innerHTML = '<div class="alert alert-light text-muted">当前岗位无必答题</div>';
    } else if (requiredQuestionsOnPage.length === 0 && currentPage > 1) {
         requiredList.innerHTML = '<div class="alert alert-light text-muted">当前页面无必答题</div>';
    } else {
        requiredQuestionsOnPage.forEach((question) => {
            const globalIndex = filteredQuestions.findIndex(q => q.id === question.id);
            const card = createQuestionCard(question, globalIndex + 1); 
            requiredList.appendChild(card);
        });
    }
    
    // 显示随机题 (当前页)
    if (totalRandomCount === 0) {
        randomList.innerHTML = '<div class="alert alert-light text-muted">当前岗位无随机题</div>';
    } else if (randomQuestionsOnPage.length === 0 && currentPage > 1) {
        randomList.innerHTML = '<div class="alert alert-light text-muted">当前页面无随机题</div>';
    } else {
        randomQuestionsOnPage.forEach((question) => {
            const globalIndex = filteredQuestions.findIndex(q => q.id === question.id);
            const card = createQuestionCard(question, globalIndex + 1); 
            randomList.appendChild(card);
        });
    }
    
    // **** 更新分页控件 ****
    updatePagination(totalItems);
}

// 创建题目卡片 (修改序号参数)
function createQuestionCard(question, displayIndex) { // 参数改为 displayIndex
    // **** 添加日志 ****
    console.log(`[createQuestionCard] Creating card for question (displayIndex ${displayIndex}):`, JSON.parse(JSON.stringify(question)));

    const card = document.createElement('div');
    card.className = 'question-card p-3 mb-3';
    
    const typeLabel = question.type === 'required' ? '必答题' : '随机题';
    const typeBadgeClass = question.type === 'required' ? 'bg-danger' : 'bg-info';
    
    // 处理可能包含HTML或图片的内容
    const standardAnswerHTML = formatAnswerContent(question.standardAnswer);

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="mb-0">${displayIndex}. ${question.content}</h6>
            <span class="badge ${typeBadgeClass} rounded-pill">${typeLabel}</span>
        </div>
        <div class="question-info">
            <div class="standard-answer-content preserve-newlines"><strong>标准答案：</strong>${standardAnswerHTML}</div>
            ${question.knowledgeSource ? `<div class="mt-1 text-muted small"><strong>知识点来源：</strong>${question.knowledgeSource}</div>` : ''}
            <div class="mt-2">
                <div class="d-flex justify-content-between">
                    <div>
                        <span class="me-3"><strong>标准分值：</strong>${question.standardScore}</span>
                        <span class="d-block mt-1"><strong>所属板块：</strong>${question.section || '未分类'}</span>
                    </div>
                    <div class="text-end align-self-end">
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="editQuestion(${question.id})">
                            <i class="bi bi-pencil"></i> 编辑
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteQuestion(${question.id})">
                            <i class="bi bi-trash"></i> 删除
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// 格式化答案内容（可选，用于处理HTML或特定格式）
function formatAnswerContent(content) {
    // 简单示例：如果内容包含<img>标签，确保它们是响应式的
    // 更复杂的处理可能需要DOMParser
    if (content && content.includes('<img')) {
        // 这是一个基础的替换，可能不够健壮，仅用于演示
        // 最好在服务器端或导入时处理HTML内容以确保安全和正确性
        // 这里我们给图片添加一个class，稍后用CSS来限制大小
        return content.replace(/<img /g, '<img class="img-fluid" '); 
    }
    return content || '无标准答案';
}

// 搜索题目
function searchQuestions() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    
    filteredQuestions = questionBank.filter(question => 
        (question.content.toLowerCase().includes(searchText) ||
        (question.standardAnswer && question.standardAnswer.toLowerCase().includes(searchText))) &&
        (currentPosition === 'all' || 
         (question.position && (question.position.includes(currentPosition) || question.position.includes('all'))))
    );
    
    currentPage = 1;
    displayQuestions();
}

// 显示添加题目模态框
function showAddQuestionModal() {
    document.getElementById('modalTitle').textContent = '添加题目';
    document.getElementById('questionForm').reset();
    document.getElementById('questionId').value = '';
    document.getElementById('section').value = '';
    document.getElementById('knowledgeSource').value = ''; // 清空知识点来源
    
    // 设置默认岗位为当前选中岗位
    document.querySelectorAll('.position-checkbox').forEach(checkbox => {
        checkbox.checked = checkbox.value === currentPosition;
    });
    
    const modal = new bootstrap.Modal(document.getElementById('questionModal'));
    modal.show();
}

// 编辑题目
function editQuestion(id) {
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const question = questionBank.find(q => q.id === id);
    if (!question) return;

    document.getElementById('modalTitle').textContent = '编辑题目';
    document.getElementById('questionId').value = question.id;
    document.getElementById('questionContent').value = question.content;
    document.getElementById('standardAnswer').value = question.standardAnswer;
    document.getElementById('questionType').value = question.type;
    document.getElementById('standardScore').value = question.standardScore;
    document.getElementById('section').value = question.section || '';
    document.getElementById('knowledgeSource').value = question.knowledgeSource || ''; // 填充知识点来源

    // 设置岗位选择
    const positions = question.position || [];
    document.querySelectorAll('.position-checkbox').forEach(checkbox => {
        checkbox.checked = positions.includes(checkbox.value);
    });

    const modal = new bootstrap.Modal(document.getElementById('questionModal'));
    modal.show();
}

// 新增：处理手动添加岗位
function addManualPosition() {
    const inputElement = document.getElementById('manualPositionInput');
    const positionName = inputElement.value.trim();
    if (!positionName) {
        alert('请输入要添加的岗位名称。');
        return;
    }

    // 简单的转换规则：尝试生成一个英文代码 (可以根据需要改进)
    // 这是一个非常基础的示例，可能需要更复杂的 Pinyin 库或映射
    let positionCode = positionName.toLowerCase().replace(/\s+/g, '_'); 
    // 检查代码是否已存在（无论是作为代码还是名称）
    const existingPosition = allPositions.find(p => 
        p === positionCode || getPositionName(p).toLowerCase() === positionName.toLowerCase()
    );
    
    if (existingPosition) {
        alert(`岗位 "${positionName}" (或其代码 ${positionCode}) 已存在。`);
        // 自动勾选现有复选框
        const checkbox = document.querySelector(`#questionModal .position-checkbox[value="${existingPosition}"]`);
        if(checkbox) checkbox.checked = true;
        inputElement.value = ''; // Clear input
        return;
    }
    
    // 假设生成成功，动态创建新的复选框
    const checkboxContainer = inputElement.closest('.mb-3'); // Find the parent container
    if (!checkboxContainer) {
        console.error("Could not find checkbox container");
        return;
    }
    
    const newCheckboxDiv = document.createElement('div');
    newCheckboxDiv.className = 'form-check';
    
    const checkboxId = `position-${positionCode}`; // Generate unique ID
    
    newCheckboxDiv.innerHTML = `
        <input class="form-check-input position-checkbox" type="checkbox" id="${checkboxId}" value="${positionCode}" checked>
        <label class="form-check-label" for="${checkboxId}">${positionName}</label>
    `;
    
    // Insert the new checkbox before the input group
    checkboxContainer.insertBefore(newCheckboxDiv, inputElement.parentElement);

    // 清空输入框
    inputElement.value = '';
    
    // (可选) 可以在这里将新岗位代码添加到全局 allPositions 数组，
    // 但更稳妥的是在 saveQuestion 时统一处理新岗位
    // allPositions.push(positionCode);
    // allPositions.sort();
}

// 修改：获取选中的岗位 (现在也包括动态添加的)
function getSelectedPositions() {
    const positions = [];
    // **** Query all checkboxes within the modal ****
    document.querySelectorAll('#questionModal .position-checkbox:checked').forEach(checkbox => {
        positions.push(checkbox.value);
    });
    // 如果一个都没选，可以返回 ['all'] 或空数组，取决于逻辑
    // return positions.length > 0 ? positions : ['all']; 
    return positions; // 返回实际选中的，如果为空则为空数组
}

// 修改：保存题目，确保处理新添加的岗位代码
function saveQuestion() {
    const form = document.getElementById('questionForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const questionId = document.getElementById('questionId').value;
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    
    const selectedPositions = getSelectedPositions();
    // **** 如果没有选择任何岗位，可以默认为 'all' 或提示用户 ****
    if (selectedPositions.length === 0) {
        // selectedPositions.push('all'); 
        alert("请至少选择一个适用岗位。");
        return; // 或者不返回，让 position 为空数组
    }

    const question = {
        id: questionId ? parseInt(questionId) : Date.now(),
        content: document.getElementById('questionContent').value,
        standardAnswer: document.getElementById('standardAnswer').value,
        type: document.getElementById('questionType').value,
        standardScore: parseInt(document.getElementById('standardScore').value),
        position: selectedPositions,
        section: document.getElementById('section').value,
        knowledgeSource: document.getElementById('knowledgeSource').value.trim() || undefined // 获取知识点来源，为空则存 undefined
    };

    let newPositionAdded = false;
    selectedPositions.forEach(p => {
        if (p !== 'all' && !allPositions.includes(p)) {
             console.log(`New position code found: ${p}`);
            newPositionAdded = true;
        }
    });

    if (questionId) {
        // 更新现有题目
        const index = questionBank.findIndex(q => q.id === parseInt(questionId));
        if (index !== -1) {
            questionBank[index] = question;
        }
    } else {
        // 添加新题目
        questionBank.push(question);
    }

    localStorage.setItem('questionBank', JSON.stringify(questionBank));
    bootstrap.Modal.getInstance(document.getElementById('questionModal')).hide();
    
    // **** 保存题库后，更新岗位映射 ****
    updateAndSaveJobPositions();

    if (newPositionAdded) {
        console.log("Reloading questions due to new position added.");
        loadQuestions(); 
    } else {
        filterByPosition(currentPosition);
    }
}

// 删除题目
function deleteQuestion(id) {
    if (!confirm('确定要删除这道题目吗？')) return;

    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const newQuestionBank = questionBank.filter(q => q.id !== id);
    localStorage.setItem('questionBank', JSON.stringify(newQuestionBank));
    loadQuestions();
}

// 格式化岗位显示
function formatPositions(positions) {
    if (!positions) return '-';
    if (positions.includes('all')) return '全部岗位';
    
    return positions.map(pos => getPositionName(pos)).join(', ');
}

// 显示导入模态框
function importQuestions() {
    const modal = new bootstrap.Modal(document.getElementById('importModal'));
    modal.show();
}

// 清空当前岗位题目
function clearQuestionsByPosition() {
    if (!confirm(`确定要清空${getPositionName(currentPosition)}的所有题目吗？`)) return;

    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    let newQuestionBank;

    if (currentPosition === 'all') {
        // 清空全部题目
        newQuestionBank = [];
    } else {
        // 只清空指定岗位的题目
        newQuestionBank = questionBank.filter(question => {
            // 保留不包含当前岗位的题目
            return !question.position || !question.position.includes(currentPosition);
        });
    }

    localStorage.setItem('questionBank', JSON.stringify(newQuestionBank));
    loadQuestions();
}

// **** 确保 getPositionCode 函数定义在这里 ****
// 新增：获取岗位代码 (用于导入)
function getPositionCode(positionName) {
    switch(positionName.trim()) {
        case '值班站长': return 'duty_station';
        case '车站值班员': return 'station_duty';
        case '站务安全员': return 'station_safety';
        case '全部岗位': return 'all';
        // 如果传入的已经是代码，直接返回
        case 'duty_station': 
        case 'station_duty': 
        case 'station_safety': 
        case 'all': 
            return positionName.trim();
        default: 
            console.warn(`未知的岗位名称，无法转换为代码: ${positionName}`);
            return null;
    }
}

// 处理导入 (确保调用 getPositionCode)
function processImport() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    if (!file) {
        alert('请选择要导入的文件。');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                throw new Error('Excel文件为空或格式不正确。');
            }

            const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
            let maxId = questionBank.reduce((max, q) => Math.max(max, q.id || 0), 0);
            let importedCount = 0;
            const errors = [];

            // 跳过表头，从第二行开始
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length < 6) {
                    errors.push(`第 ${i + 1} 行数据不完整，已跳过。`);
                    continue;
                }

                const content = row[0] ? String(row[0]).trim() : '';
                const standardAnswer = row[1] ? String(row[1]).trim() : ''; // 允许为空
                const typeText = row[2] ? String(row[2]).trim() : '必答题';
                const standardScore = parseInt(row[3]);
                const positionText = row[4] ? String(row[4]).trim() : '';
                const section = row[5] ? String(row[5]).trim() : '';
                const knowledgeSource = row[6] ? String(row[6]).trim() : ''; // 读取知识点来源 (第7列)

                // **** 修改检查：不再要求 standardAnswer 必须存在 ****
                if (!content || isNaN(standardScore)) {
                    errors.push(`第 ${i + 1} 行数据无效 (内容或分值错误)，已跳过。`);
                    continue;
                }

                const type = typeText === '随机题' ? 'random' : 'required';
                const positions = positionText ? positionText.split(/,|，|;|；|\s+/).map(p => p.trim()).filter(p => p) : [];
                
                // **** 确保调用 getPositionCode ****
                const positionCodes = positions.map(p => getPositionCode(p)).filter(p => p !== null); 
                
                if (positionCodes.length === 0 && positionText.trim() !== '') {
                     errors.push(`第 ${i + 1} 行的岗位名称无法识别: ${positionText}，已跳过该题岗位设置。`);
                } else if (positionCodes.length === 0 && positionText.trim() === '') {
                    console.log(`第 ${i+1} 行未指定岗位，将不设置岗位信息。`);
                }

                maxId++;
                const newQuestion = {
                    id: maxId,
                    content: content,
                    standardAnswer: standardAnswer,
                    type: type,
                    standardScore: standardScore,
                    position: positionCodes.length > 0 ? positionCodes : undefined,
                    section: section,
                    knowledgeSource: knowledgeSource || undefined // 存储知识点来源，为空则存 undefined
                };
                questionBank.push(newQuestion);
                importedCount++;
            }

            localStorage.setItem('questionBank', JSON.stringify(questionBank));
            
            // **** 导入完成后，重新加载题目和标签，并更新岗位映射 ****
            updateAndSaveJobPositions();
            loadQuestions();

            bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
            
            let message = `成功导入 ${importedCount} 条题目。
`;
            if (errors.length > 0) {
                message += "\n以下行导入失败或跳过：\n" + errors.join("\n");
            }
            alert(message);

        } catch (error) {
            console.error("导入失败:", error);
            alert(`导入失败：${error.message}`);
        }
    };
    reader.onerror = function() {
        alert('文件读取失败。');
    };
    reader.readAsArrayBuffer(file);
}

// 获取单元格值
function getCellValue(sheet, row, col) {
    const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
    const cell = sheet[cellAddress];
    return cell ? cell.v : '';
}

// 下载模板
function downloadTemplate() {
    const template = [
        {
            '题目内容': '示例题目1',
            '标准答案': '示例答案1',
            '题目类型': '必答题',
            '标准分值': 100,
            '适用岗位': '值班站长、车站值班员',
            '所属板块': '示例板块',
            '知识点来源': '示例来源，例如：《XX手册》第 Y 节'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '题目模板');
    XLSX.writeFile(wb, '题目导入模板.xlsx');
}

// 导出题库
function exportQuestions() {
    const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    const exportData = questionBank.map(q => ({
        '题目内容': q.content,
        '标准答案': q.standardAnswer,
        '题目类型': q.type === 'required' ? '必答题' : '随机题',
        '标准分值': q.standardScore,
        '适用岗位': formatPositions(q.position),
        '所属板块': q.section || '',
        '知识点来源': q.knowledgeSource ? q.knowledgeSource : '无'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '题库');
    XLSX.writeFile(wb, '岗位胜任力测评题库.xlsx');
}

// **** 新增：更新分页控件 ****
function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginationContainer = document.getElementById('paginationContainer');
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return; // 如果只有一页或没有内容，则不显示分页

    // 创建分页按钮的辅助函数
    const createPageItem = (page, text, isDisabled = false, isActive = false) => {
        const li = document.createElement('li');
        li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
        const link = document.createElement('a');
        link.className = 'page-link';
        link.href = '#';
        link.textContent = text;
        if (!isDisabled) {
            link.onclick = (e) => {
                e.preventDefault();
                changePage(page);
            };
        }
        li.appendChild(link);
        return li;
    };

    // 上一页按钮
    paginationContainer.appendChild(createPageItem(currentPage - 1, '上一页', currentPage === 1));

    // 页码按钮 (可以根据需要添加省略号逻辑)
    // 简单的页码显示：
    for (let i = 1; i <= totalPages; i++) {
        paginationContainer.appendChild(createPageItem(i, i.toString(), false, currentPage === i));
    }
    // 更复杂的逻辑可以只显示当前页附近和首尾页码

    // 下一页按钮
    paginationContainer.appendChild(createPageItem(currentPage + 1, '下一页', currentPage === totalPages));
}

// **** 新增：切换页面 ****
function changePage(page) {
    const totalPages = Math.ceil(filteredQuestions.length / pageSize);
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    currentPage = page;
    displayQuestions(); // 重新显示当前页的题目
    
    // 可选：滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// **** 新增：初始化拖拽区域 ****
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('importFile');

    if (!dropZone || !fileInput) {
        console.warn("Drop zone or file input not found, drag & drop disabled.");
        return;
    }

    dropZone.addEventListener('click', (e) => {
        // 防止点击内部按钮时也触发文件选择
        if (e.target.tagName !== 'BUTTON') { 
             fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // 阻止默认行为 (打开文件)
        dropZone.classList.add('border-primary'); // 添加高亮边框
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-primary'); // 移除高亮边框
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); 
        dropZone.classList.remove('border-primary');

        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            // 验证文件类型
            if (file.name.match(/\.(xlsx|xls|csv)$/i)) { 
                fileInput.files = e.dataTransfer.files; // 将拖拽的文件赋值给隐藏的input
                displaySelectedFileName(fileInput); // 更新显示并启用按钮
            } else {
                alert('请拖拽有效的 Excel 或 CSV 文件 (.xlsx, .xls, .csv)');
            }
        }
    });
}

// **** 新增：显示选中的文件名并启用导入按钮 ****
function displaySelectedFileName(inputElement) {
    const selectedFileNameElement = document.getElementById('selectedFileName');
    const importProcessBtn = document.getElementById('importProcessBtn');
    if (inputElement.files.length > 0) {
        selectedFileNameElement.textContent = `已选择: ${inputElement.files[0].name}`;
        importProcessBtn.disabled = false; // 启用导入按钮
    } else {
        selectedFileNameElement.textContent = '';
        importProcessBtn.disabled = true; // 禁用导入按钮
    }
}

// **** 新增：重置导入模态框状态 ****
function setupModalReset() {
    const importModalElement = document.getElementById('importModal');
    if (importModalElement) {
        importModalElement.addEventListener('hidden.bs.modal', function () {
            const fileInput = document.getElementById('importFile');
            const selectedFileNameElement = document.getElementById('selectedFileName');
            const importProcessBtn = document.getElementById('importProcessBtn');
            
            if(fileInput) fileInput.value = ''; // 清空文件选择
            if(selectedFileNameElement) selectedFileNameElement.textContent = ''; // 清空显示的文件名
            if(importProcessBtn) importProcessBtn.disabled = true; // 禁用导入按钮
            console.log("Import modal closed, state reset.");
        });
    }
} 