// LeanCloud SDK Initialization
const APP_ID = 'WL96U3J6bC9A7nDWV7l9Y1O9-gzGzoHsz';
// const APP_KEY = '替换为你的 App Key'; // 不再需要 App Key
// **[修改]** 对于中国区应用，必须提供 Server URL
// 请在 LeanCloud 控制台 -> 设置 -> 应用凭证 -> API 访问域名 确认此地址
const SERVER_URL = 'https://wl96u3j6.lc-cn-n1-shared.com'; // **[修改]** 使用截图确认的地址

try {
  AV.init({
    appId: APP_ID,
    // appKey: APP_KEY, // <-- 注释掉这一行
    serverURL: SERVER_URL // **[修改]** 取消注释并设置 serverURL
  });
  console.log("LeanCloud SDK Initialized Successfully with Server URL."); // 确认初始化成功
} catch (error) {
   console.error("LeanCloud SDK Initialization Failed:", error); // 报告初始化错误
}

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

// 全局 Helper 函数：格式化日期 (如果其他 JS 文件需要它)
function formatDate(dateString, includeTime = false) {
    // ... (函数体保持不变)
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        if (includeTime) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${year}${month}${day}_${hours}${minutes}${seconds}`; // 用于文件名的格式
        } else {
            return `${year}-${month}-${day}`; // 用于显示的格式
        }
    } catch (e) {
        console.error("日期格式化错误:", e);
        return dateString; // Fallback
    }
}

// 全局 Helper 函数：获取车站名称 (如果其他 JS 文件需要它)
function getStationName(code) {
    // ... (函数体保持不变)
    const stationMap = {
        'grand_hall': '大礼堂',
        'seven_hills': '七星岗',
        'houbao': '后堡',
        'wanshou': '万寿路',
        'nanhu': '南湖',
        'lanhua': '兰花路'
    };
    return stationMap[code] || code || '未知';
}

// // 示例：检查本地题库版本，如果需要则从服务器更新 (可选功能)
// function checkAndUpdateQuestionBank() {
//     const localVersion = localStorage.getItem('questionBankVersion');
//     // 假设我们从服务器某处获取最新版本号
//     fetch('/api/question-bank-version') // 这是一个示例 URL
//         .then(response => response.json())
//         .then(serverData => {
//             if (!localVersion || localVersion < serverData.version) {
//                 console.log('题库有更新，正在下载...');
//                 fetch('/api/question-bank') // 示例 URL
//                     .then(response => response.json())
//                     .then(questions => {
//                         localStorage.setItem('questionBank', JSON.stringify(questions));
//                         localStorage.setItem('questionBankVersion', serverData.version);
//                         console.log('题库更新完成。');
//                         // 可能需要通知用户或重新加载依赖题库的页面部分
//                     })
//                     .catch(error => console.error('下载新题库失败:', error));
//             } else {
//                 console.log('本地题库已是最新版本。');
//             }
//         })
//         .catch(error => console.error('检查题库版本失败:', error));
// }

// // 页面加载时检查更新 (如果启用该功能)
// document.addEventListener('DOMContentLoaded', () => {
//     // checkAndUpdateQuestionBank(); 
// }); 