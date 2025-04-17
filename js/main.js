// 全局变量
let currentUserInfo = {
    name: '',
    employeeId: '',
    station: '',
    position: ''
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeSystem();
});

// 系统初始化
function initializeSystem() {
    // 检查本地存储中是否有题库
    if (!localStorage.getItem('questionBank')) {
        // initializeQuestionBank(); // <--- 确保这一行被注释掉了
        console.log("No question bank found in localStorage. Initializing as empty."); // (这行可选，用于确认)
        localStorage.setItem('questionBank', '[]'); // (这行可选，用于初始化空题库)
    }
    // **** 新增：初始化时也更新岗位映射 ****
    updateAndSaveJobPositions();
}

// 初始化题库
function initializeQuestionBank() {
    const defaultQuestions = [
        {
            id: 1,
            content: "请描述您对岗位职责的理解",
            type: "required",
            standardAnswer: "岗位职责包括...",
            standardScore: 100,
            position: ["all"]
        }
        // 可以添加更多默认题目
    ];
    localStorage.setItem('questionBank', JSON.stringify(defaultQuestions));
}

// 开始测评
function startAssessment() {
    window.location.href = 'assessment.html';
}

// 查看历史记录
function viewHistory() {
    window.location.href = 'history.html';
}

// 维护题库
function maintainQuestionBank() {
    window.location.href = 'question-bank.html';
}

// 查看数据分析
function viewAnalysis() {
    window.location.href = 'analysis.html';
}

// 数据验证函数
function validateUserInfo(info) {
    if (!info.name || !info.employeeId || !info.station || !info.position) {
        return false;
    }
    return true;
}

// 保存用户信息
function saveUserInfo(info) {
    if (validateUserInfo(info)) {
        currentUserInfo = info;
        sessionStorage.setItem('currentUserInfo', JSON.stringify(info));
        return true;
    }
    return false;
}

// 获取题目
function getQuestions(position) {
    const questionBank = JSON.parse(localStorage.getItem('questionBank'));
    const requiredQuestions = questionBank.filter(q => q.type === 'required');
    const randomQuestions = questionBank.filter(q => 
        q.type === 'random' && 
        (q.position.includes('all') || q.position.includes(position))
    );
    
    // 随机选择5道题
    const selectedRandom = randomQuestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);
    
    return [...requiredQuestions, ...selectedRandom];
}

// 保存答案
function saveAnswer(questionId, answer) {
    const answers = JSON.parse(sessionStorage.getItem('currentAnswers') || '{}');
    answers[questionId] = {
        ...answer,
        timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('currentAnswers', JSON.stringify(answers));
}

// 计算得分
function calculateScore(answers) {
    let totalScore = 0;
    let standardScore = 0;
    
    Object.entries(answers).forEach(([questionId, answer]) => {
        const question = JSON.parse(localStorage.getItem('questionBank'))
            .find(q => q.id === parseInt(questionId));
        if (question) {
            totalScore += answer.score || 0;
            standardScore += question.standardScore;
        }
    });
    
    return {
        totalScore,
        standardScore,
        scoreRate: standardScore > 0 ? (totalScore / standardScore * 100).toFixed(2) : 0
    };
}

// **** 新增：从 question-bank.js 复制必要的辅助函数 ****

// 获取岗位名称 (与 question-bank.js 保持一致)
function getPositionName(code) {
    const positionMap = {
        'duty_station': '值班站长',
        'station_duty': '车站值班员',
        'station_safety': '站务安全员'
        // 在这里可以根据需要添加更多岗位
    };
     // 也处理中文名称直接传入的情况
    if (['值班站长', '车站值班员', '站务安全员'].includes(code)) {
        return code;
    }
    return positionMap[code] || code || '未知'; // 如果找不到映射，返回原始代码或'未知'
}

// 生成并保存岗位代码到名称的映射 (与 question-bank.js 保持一致)
function updateAndSaveJobPositions() {
    try {
        const questionBankData = localStorage.getItem('questionBank');
        const questionBank = JSON.parse(questionBankData || '[]');
        const positionMap = {};
        questionBank.forEach(q => {
            if (q.position && Array.isArray(q.position)) {
                q.position.forEach(p => {
                    if (p && p !== 'all') {
                        const trimmedP = p.trim();
                        if (trimmedP && !positionMap[trimmedP]) { // Add check for trimmed value
                            positionMap[trimmedP] = getPositionName(trimmedP); 
                        }
                    }
                });
            }
        });
        localStorage.setItem('jobPositions', JSON.stringify(positionMap));
        // Comment out frequent log
        // console.log("Main.js: Updated and saved jobPositions to localStorage:", positionMap);
    } catch (error) {
         console.error("Main.js: Error updating jobPositions:", error);
    }
}

// **** 结束新增辅助函数 **** 