console.log("--- js/main.js script started ---"); // 新增日志：确认脚本开始执行

// LeanCloud SDK Initialization
const APP_ID = 'WL96U3J6p1jX1Jpj1EiuLKJG-gzGzoHsz'; // <-- 使用截图确认的正确 App ID
const APP_KEY = 'YvkBWa4EkM28Wa8QfmlXiCFa'; // <-- 取消注释，并确保这里是正确的 App Key
// **[修改]** 对于中国区应用，必须提供 Server URL
// 请在 LeanCloud 控制台 -> 设置 -> 应用凭证 -> API 访问域名 确认此地址
const SERVER_URL = 'https://wl96u3j6.lc-cn-n1-shared.com'; // **[修改]** 使用截图确认的地址

console.log("Attempting LeanCloud SDK Initialization..."); // 新增日志：确认即将尝试初始化
try {
  AV.init({
    appId: APP_ID,
    appKey: APP_KEY, // <-- 取消注释这一行
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

// **** 新增：全局变量用于登录 ****
let currentUser = null; // 存储当前登录用户
let loginModalInstance = null; // 登录模态框实例 (如果使用 Bootstrap)
let startAssessmentAfterLogin = false; // 标记是否登录后立即开始测评（特定于assessment页面，但变量放在这里）

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log("[DOMContentLoaded in main.js] Initializing system and auth UI..."); // 确认 main.js 的 DOMContentLoaded 执行
    initializeSystem();

    // **** 新增：认证相关初始化 ****
    // 获取模态框实例 (如果使用 Bootstrap)
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement && typeof bootstrap !== 'undefined') { // 确保 bootstrap JS 已加载
        console.log("[main.js] Found loginModal element and bootstrap. Creating modal instance.");
        loginModalInstance = new bootstrap.Modal(loginModalElement);
    } else if (loginModalElement) {
         console.warn("[main.js] Bootstrap Modal JS not found for loginModal, using basic show/hide.");
    } else {
         // console.log("[main.js] loginModal element not found on this page."); // 如果页面没有登录模态框，这是正常的
    }

    // 绑定模态框登录按钮事件 (如果存在)
    const loginSubmitButton = document.getElementById('loginSubmitButton');
    if (loginSubmitButton) {
        console.log("[main.js] Adding click listener to loginSubmitButton.");
        loginSubmitButton.addEventListener('click', handleLogin);
    }

    // 检查用户登录状态
    if (typeof AV !== 'undefined' && AV.User) { // 确保 AV SDK 已加载
        currentUser = AV.User.current();
        if (currentUser) {
            console.log(`[main.js] User already logged in: ${currentUser.getUsername()}`);
        } else {
            console.log("[main.js] User not logged in initially.");
        }
    } else {
        console.warn("[main.js] AV SDK or AV.User is not available yet for checking current user.");
        // 可以考虑稍后重试或依赖其他逻辑
    }


    // 更新导航栏 UI (确保在 currentUser 可能被设置后调用)
    updateAuthUI();
    // **** 结束新增认证相关初始化 ****

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

// **** 新增：从 assessment.js 移动过来的认证函数 ****

// 处理登录
async function handleLogin() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorAlert = document.getElementById('loginErrorAlert');
    const loginButton = document.getElementById('loginSubmitButton');

    // 确保元素存在
    if (!usernameInput || !passwordInput || !errorAlert || !loginButton) {
        console.error("Login form elements not found!");
        alert("登录表单似乎不完整，请联系管理员。");
        return;
    }


    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    errorAlert.style.display = 'none'; // 隐藏旧错误

    if (!username || !password) {
        errorAlert.textContent = '请输入用户名和密码。';
        errorAlert.style.display = 'block';
        return;
    }

    loginButton.disabled = true; // 防止重复点击
    loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登录中...';

    try {
        // 确保 AV 和 AV.User 可用
        if (typeof AV === 'undefined' || !AV.User) {
            throw new Error("LeanCloud SDK 未正确加载，无法登录。");
        }

        currentUser = await AV.User.logIn(username, password);
        console.log(`[main.js] Login successful for user: ${currentUser.getUsername()}`);

        hideLoginModal(); // 关闭模态框
        updateAuthUI(); // 更新导航栏

        // 清空密码输入框
        passwordInput.value = '';

        // **** 检查是否在 assessment 页面并且需要开始测评 ****
        // 这个逻辑仍然只对 assessment 页面有意义
        if (window.location.pathname.endsWith('assessment.html') && startAssessmentAfterLogin) {
            console.log("[main.js] Proceeding to start assessment after login...");
            startAssessmentAfterLogin = false; // 重置标记
            // 确保 startAssessment 函数在 assessment.js 中可用或在此处定义
            if (typeof startAssessment === 'function') {
                 startAssessment(); // 重新调用开始测评函数 (需要 assessment.js 定义此函数)
            } else {
                console.warn("startAssessment function not found. Cannot start assessment automatically.");
                 // 登录后默认行为（可能需要跳转到首页或 assessment 页）
                 window.location.href = 'assessment.html'; // 或者跳转到 index.html
            }
        } else {
             // 如果只是普通登录，更新UI后可能不需要做额外操作
             console.log("[main.js] Login successful. Auth UI updated.");
             // 如果当前在 assessment.html 且不需要自动开始，确保显示设置表单
             if (window.location.pathname.endsWith('assessment.html')) {
                 const userInfoForm = document.getElementById('userInfoForm');
                 const assessmentArea = document.getElementById('assessmentArea');
                 if (userInfoForm) userInfoForm.classList.remove('d-none');
                 if (assessmentArea) assessmentArea.classList.add('d-none');
                 // 确保 initializeForm 可用
                 if (typeof initializeForm === 'function') {
                     initializeForm();
                 }
             }
        }

    } catch (error) {
        console.error("[main.js] Login failed:", error);
        errorAlert.textContent = `登录失败: ${error.message || '未知错误'}`;
        errorAlert.style.display = 'block';
    } finally {
        loginButton.disabled = false; // 恢复按钮
        loginButton.textContent = '登录';
    }
}

// 处理登出
async function handleLogout() {
     // showLoading 可能在特定页面才有，需要检查
     if (typeof showLoading === 'function') {
         showLoading("正在登出...");
     } else {
         console.log("Logging out...");
     }
     try {
         // 确保 AV 和 AV.User 可用
         if (typeof AV === 'undefined' || !AV.User) {
             throw new Error("LeanCloud SDK 未正确加载，无法登出。");
         }
         await AV.User.logOut();
         currentUser = null;
         startAssessmentAfterLogin = false; // 重置标记
         console.log("[main.js] Logout successful.");
         updateAuthUI(); // 更新导航栏

         // 登出后的页面跳转或UI更新逻辑
         // 简单的做法是跳转回首页
         alert("您已成功登出。");
         window.location.href = 'index.html'; // 或者 assessment.html

         /*
         // 如果想留在当前页面并更新UI (更复杂，需要确保各页面元素存在)
         // 例如，在 assessment.html 上：
         if (window.location.pathname.endsWith('assessment.html')) {
             document.getElementById('userInfoForm')?.classList.remove('d-none');
             document.getElementById('assessmentArea')?.classList.add('d-none');
             if (typeof initializeForm === 'function') initializeForm();
             if (typeof stopTimer === 'function') stopTimer(); // 停止计时器
             // 清理测评状态变量 (需要确保这些变量在 assessment.js 中定义)
             // currentAssessmentData = null; currentQuestions = []; userAnswers = {}; currentQuestionIndex = 0;
         }
         // 其他页面可能需要不同的处理

         if (typeof hideLoading === 'function') {
             hideLoading();
         }
         */

     } catch (error) {
          if (typeof hideLoading === 'function') {
             hideLoading();
         }
         console.error("[main.js] Logout failed:", error);
         alert("登出失败: " + error.message);
     }
}

// 更新导航栏认证相关UI
function updateAuthUI() {
    console.log("[main.js] Attempting to update Auth UI (v2 - Circle Icon Style)...");
    const authLink = document.getElementById('authLink');
    const authIcon = document.getElementById('authIcon');
    const authLabel = document.getElementById('authLabel');

    // 如果页面上没有这些新元素，就直接返回
    if (!authLink || !authIcon || !authLabel) {
        // console.log("[main.js] Auth link/icon/label elements not found on this page. Skipping UI update.");
        return;
    }
    console.log("[main.js] Found auth link, icon, and label elements.");

    // 再次检查 currentUser 状态
    if (!currentUser && typeof AV !== 'undefined' && AV.User) {
        currentUser = AV.User.current();
    }

    // 移除旧的事件监听器，防止重复绑定
    authLink.removeEventListener('click', showLoginModal);
    authLink.removeEventListener('click', handleLogoutWrapper); // 使用包装函数
    authLink.onclick = null; // 清除可能存在的旧 onclick

    if (currentUser) {
        const userName = currentUser.get('name') || currentUser.getUsername();
        console.log(`[main.js] Updating UI for logged in user: ${userName}`);
        // 已登录
        authLabel.textContent = userName;
        authIcon.className = 'bi bi-person-check-fill'; // 更新图标为 'check' 状态
        authLink.title = `已登录: ${userName} (点击登出)`;
        // 绑定登出事件到链接
        authLink.addEventListener('click', handleLogoutWrapper);
    } else {
        console.log("[main.js] Updating UI for logged out user.");
        // 未登录
        authLabel.textContent = '登录';
        authIcon.className = 'bi bi-person-circle'; // 默认用户图标
        authLink.title = '点击登录';
        // 绑定显示登录模态框事件到链接
        authLink.addEventListener('click', showLoginModalWrapper);
    }
}

// **** 新增：包装函数以处理事件对象 ****
function handleLogoutWrapper(event) {
    event.preventDefault(); // 阻止链接默认行为
    handleLogout();
}

function showLoginModalWrapper(event) {
    event.preventDefault(); // 阻止链接默认行为
    showLoginModal();
}

// 显示登录模态框
function showLoginModal() {
    console.log("[main.js] showLoginModal called.");
    // 清理可能存在的旧错误信息
    const errorAlert = document.getElementById('loginErrorAlert');
    if(errorAlert) errorAlert.style.display = 'none';

    if (loginModalInstance) {
         console.log("[main.js] Showing login modal using Bootstrap instance.");
        loginModalInstance.show();
    } else {
         console.warn("[main.js] Login modal instance not available. Attempting fallback show.");
         // Fallback for non-Bootstrap or if instance failed to initialize
         const modalElement = document.getElementById('loginModal');
         if(modalElement) {
             modalElement.style.display = 'block'; // 或者添加 'show' class
             modalElement.classList.add('show'); // Bootstrap 5 uses 'show' class
         } else {
             console.error("[main.js] Login modal element ('loginModal') not found. Cannot show modal.");
             alert("无法打开登录框。请刷新页面或联系管理员。");
         }
    }
}

// 隐藏登录模态框
function hideLoginModal() {
     console.log("[main.js] hideLoginModal called.");
     if (loginModalInstance) {
        loginModalInstance.hide();
    } else {
         console.warn("[main.js] Login modal instance not available. Attempting fallback hide.");
         const modalElement = document.getElementById('loginModal');
         if(modalElement) {
             modalElement.style.display = 'none';
             modalElement.classList.remove('show');
         }
    }
}


// **** 结束新增认证函数 **** 