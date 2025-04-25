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
        loginSubmitButton.addEventListener('click', handleLogin); // **** 修改: handleLogin 现在处理登录视图 ****
    }

    // **** 新增: 绑定模态框注册按钮事件 ****
    const registerSubmitButton = document.getElementById('registerSubmitButton');
    if (registerSubmitButton) {
        console.log("[main.js] Adding click listener to registerSubmitButton.");
        registerSubmitButton.addEventListener('click', handleRegister); // **** 修改: handleRegister 现在处理注册视图 ****
    }

    // **** 新增: 绑定模态框内切换视图的链接事件 ****
    const switchToRegisterLink = document.getElementById('switchToRegisterLink');
    if (switchToRegisterLink) {
        switchToRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchToRegisterView();
        });
    }
    const switchToLoginLink = document.getElementById('switchToLoginLink');
    if (switchToLoginLink) {
        switchToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchToLoginView();
        });
    }
    // **** 结束新增 ****

    // **** 新增：绑定忘记密码链接事件 ****
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', handleForgotPassword);
    }
    // **** 结束新增 ****

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

    // **** 新增：为导航栏的登录/注册链接添加事件监听器 ****
    const navLoginRegisterLink = document.querySelector('.logged-out-item a, .logged-out-item button'); // 尝试查找 a 或 button
    if (navLoginRegisterLink) {
        console.log("[main.js] Adding click listener to navbar Login/Register link.");
        navLoginRegisterLink.addEventListener('click', (event) => {
            event.preventDefault(); // 阻止默认行为
            showLoginModal();     // 显示登录模态框
        });
    } else {
        console.warn("[main.js] Could not find the navbar Login/Register link with selector '.logged-out-item a, .logged-out-item button'. Modal won't open from navbar link.");
    }
    // **** 结束新增 ****

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
    console.log("[handleLogin] Login process started.");
    const emailInput = document.getElementById('loginEmail'); 
    const passwordInput = document.getElementById('loginPassword');
    const errorAlert = document.getElementById('authErrorAlert'); // **** 修改: 使用统一的错误提示框 ****

    // 清除旧错误
    if (errorAlert) errorAlert.classList.add('d-none');

    if (!emailInput || !passwordInput) {
        console.error("[handleLogin] Login form elements not found.");
        showAuthError('登录表单元素未找到！');
        return;
    }

    const email = emailInput.value.trim(); 
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showAuthError('请输入邮箱和密码！');
        return;
    }

    console.log(`[handleLogin] Attempting login for email: ${email}`);

    // 可选: 添加加载状态到按钮
    const loginButton = document.getElementById('loginSubmitButton');
    if (loginButton) loginButton.disabled = true;

    try {
        currentUser = await AV.User.logIn(email, password); 
        console.log(`[handleLogin] Login successful for user: ${currentUser.getUsername()}`);
        alert('登录成功！');
        hideLoginModal();
        updateAuthUI();
        if (startAssessmentAfterLogin) {
            console.log("[handleLogin] Redirecting to assessment page after login.");
            startAssessmentAfterLogin = false; 
            window.location.href = 'assessment.html';
        }
    } catch (error) {
        console.error("[handleLogin] Login failed:", error);
        let errorMessage = '登录失败，请稍后重试。';
        if (error.code === 210 || error.code === 211) {
            errorMessage = '邮箱或密码错误。';
        } else if (error.code === 219) {
            errorMessage = '登录失败次数过多，请稍后再试或重置密码。';
        }
        showAuthError(errorMessage); // **** 修改: 使用新的错误显示函数 ****
    } finally {
        if (loginButton) loginButton.disabled = false; // 恢复按钮状态
    }
}

// **** 修改：处理注册 ****
async function handleRegister() {
    console.log("[handleRegister] Registration process started.");
    const emailInput = document.getElementById('loginEmail'); // **** 修改: 复用邮箱输入框 ****
    const passwordInput = document.getElementById('loginPassword'); // **** 修改: 复用密码输入框 ****
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const errorAlert = document.getElementById('authErrorAlert'); // **** 修改: 使用统一的错误提示框 ****

    // 清除旧错误
    if (errorAlert) errorAlert.classList.add('d-none');

    if (!emailInput || !passwordInput || !confirmPasswordInput) {
        console.error("[handleRegister] Registration form elements not found.");
        showAuthError('注册表单元素未找到！');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!email || !password || !confirmPassword) {
        showAuthError('请输入邮箱、密码和确认密码！');
        return;
    }

    if (password !== confirmPassword) {
        showAuthError('两次输入的密码不一致！');
        return;
    }

    if (password.length < 6) {
       showAuthError('密码长度不能少于 6 位！');
       return;
    }

    console.log(`[handleRegister] Attempting registration for email: ${email}`);

    // 可选: 添加加载状态到按钮
    const registerButton = document.getElementById('registerSubmitButton');
    if (registerButton) registerButton.disabled = true;

    const user = new AV.User();
    user.setUsername(email);
    user.setPassword(password);
    user.setEmail(email);

    try {
        const loggedInUser = await user.signUp();
        console.log('[handleRegister] Registration successful:', loggedInUser);
        currentUser = loggedInUser; 
        alert('注册成功！您已自动登录。');
        hideLoginModal(); 
        updateAuthUI();
        
        AV.User.requestEmailVerify(email).then(() => {
            console.log('[handleRegister] Verification email sent.');
        }).catch(error => {
            console.error('[handleRegister] Failed to send verification email:', error);
        });

    } catch (error) {
        console.error('[handleRegister] Registration failed:', error);
        let errorMessage = '注册失败，请稍后重试。';
        if (error.code === 202 || error.code === 203) {
            errorMessage = '该邮箱已被注册。';
        } else if (error.code === 125) {
            errorMessage = '请输入有效的邮箱地址。';
        }
        showAuthError(errorMessage); // **** 修改: 使用新的错误显示函数 ****
    } finally {
         if (registerButton) registerButton.disabled = false; // 恢复按钮状态
    }
}

// **** 结束修改注册处理 ****

async function handleLogout() {
    console.log("[handleLogout] Logout process started.");
    try {
        await AV.User.logOut();
        currentUser = null; 
        console.log("[handleLogout] Logout successful.");
        alert('您已成功退出登录。');
        updateAuthUI(); 
        // Optionally reload or redirect
        // window.location.reload(); 
    } catch (error) {
        console.error("[handleLogout] Logout failed:", error);
        alert('退出登录失败，请稍后重试。');
    }
}

// **** 修改：更新认证 UI (导航栏按钮) ****
function updateAuthUI() {
    console.log("[updateAuthUI] Updating authentication UI elements...");
    const loggedInItems = document.querySelectorAll('.logged-in-item');
    const loggedOutItems = document.querySelectorAll('.logged-out-item');
    const requiresLoginLinks = document.querySelectorAll('.requires-login');
    const loggedInUserLabel = document.getElementById('loggedInUserLabel'); // **** 新增：获取用户标签元素 ****

    currentUser = AV.User.current(); // 确保获取最新的用户状态
    console.log("[updateAuthUI] Current User:", currentUser ? currentUser.getUsername() : "None");

    if (currentUser) {
        console.log(`[updateAuthUI] Updating UI for logged in user: ${currentUser.getUsername()}`);
        loggedInItems.forEach(item => item.style.display = 'inline-block'); // Or 'flex' or appropriate display value
        loggedOutItems.forEach(item => item.style.display = 'none');

        // 移除需要登录链接的禁用样式 (如果应用了的话)
        requiresLoginLinks.forEach(link => {
            link.classList.remove('disabled');
            link.removeAttribute('aria-disabled');
            link.style.pointerEvents = 'auto';
            link.style.opacity = '1';
            // 移除可能的事件监听器阻止
            link.onclick = null; // 简单移除，或恢复原始 onclick
        });
        
        // **** 新增：更新导航栏标签为用户名 ****
        if (loggedInUserLabel) {
            const userName = currentUser.get('name') || currentUser.getEmail() || currentUser.getUsername() || '用户';
            loggedInUserLabel.textContent = userName;
            console.log(`[updateAuthUI] Set loggedInUserLabel text to: ${userName}`);
        } else {
            console.warn("[updateAuthUI] Element with ID 'loggedInUserLabel' not found for updating username.");
        }
        // **** 结束新增 ****

    } else {
        console.log("[updateAuthUI] Updating UI for logged out user.");
        loggedInItems.forEach(item => item.style.display = 'none');
        loggedOutItems.forEach(item => item.style.display = 'inline-block'); // Or 'flex'

        // 禁用需要登录的链接
        requiresLoginLinks.forEach(link => {
            link.classList.add('disabled');
            link.setAttribute('aria-disabled', 'true');
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.65';
            // 添加点击事件以显示登录提示
            link.onclick = (e) => {
                e.preventDefault();
                // alert('请先登录后再访问此页面。'); // 可以用 alert
                showLoginModal(); // 或者直接显示登录模态框
            };
        });
        // **** 新增：如果用户登出，恢复标签为"个人中心" ****
        if (loggedInUserLabel) {
            loggedInUserLabel.textContent = '个人中心'; 
        }
        // **** 结束新增 ****
    }
    console.log("[updateAuthUI] UI update finished.");
}
// **** 结束修改 ****

// Wrapper functions (保留，因为 handleLogoutWrapper 和 showLoginModalWrapper 仍在使用)
function handleLoginWrapper(event) {
    if (event) event.preventDefault(); 
    handleLogin();
}

function handleRegisterWrapper(event) { // 虽然注册按钮在模态框内，但保留以防万一
    if (event) event.preventDefault(); 
    handleRegister();
}

function handleLogoutWrapper(event) {
    if (event) event.preventDefault();
    handleLogout();
}

function showLoginModalWrapper(event) {
    if (event) event.preventDefault();
    showLoginModal(); // 调用显示模态框的函数
}

// **** REMOVE: 显示/隐藏注册模态框的函数 ****
// let registerModalInstance = null; 
// function showRegisterModalWrapper(event) { ... }
// function showRegisterModal() { ... }
// function hideRegisterModal() { ... }
// **** END REMOVE ****

// **** 新增: 控制登录/注册视图切换 ****
function switchToRegisterView() {
    console.log("Switching to register view in modal.");
    const modal = document.getElementById('loginModal');
    if (!modal) return;

    modal.querySelector('#loginModalLabel').textContent = '注册新用户';
    modal.querySelectorAll('.registration-field').forEach(el => el.classList.remove('d-none'));
    modal.querySelector('#loginSubmitButton').classList.add('d-none');
    modal.querySelector('#registerSubmitButton').classList.remove('d-none');
    modal.querySelector('#switchToRegisterLink').classList.add('d-none');
    modal.querySelector('#switchToLoginLink').classList.remove('d-none');
    // 清除可能存在的错误提示
    const errorAlert = modal.querySelector('#authErrorAlert');
    if(errorAlert) errorAlert.classList.add('d-none');
}

function switchToLoginView() {
    console.log("Switching to login view in modal.");
    const modal = document.getElementById('loginModal');
    if (!modal) return;

    modal.querySelector('#loginModalLabel').textContent = '请登录';
    modal.querySelectorAll('.registration-field').forEach(el => el.classList.add('d-none'));
    modal.querySelector('#loginSubmitButton').classList.remove('d-none');
    modal.querySelector('#registerSubmitButton').classList.add('d-none');
    modal.querySelector('#switchToRegisterLink').classList.remove('d-none');
    modal.querySelector('#switchToLoginLink').classList.add('d-none');
    // 清除可能存在的错误提示
    const errorAlert = modal.querySelector('#authErrorAlert');
    if(errorAlert) errorAlert.classList.add('d-none');
}

// **** 新增: 显示认证错误信息 ****
function showAuthError(message) {
    const errorAlert = document.getElementById('authErrorAlert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
    }
}
// **** 结束新增 ****

// Utility function to show the login modal (修改: 确保切换回登录视图)
function showLoginModal() {
    console.log("[showLoginModal] Attempting to show login modal.");
    // **** 新增: 每次打开时，确保是登录视图 ****
    switchToLoginView(); 

    const loginModalElement = document.getElementById('loginModal');
    if (!loginModalElement) {
        console.error("Login modal element (#loginModal) not found.");
        alert('无法找到登录窗口元素！');
        return;
    }
    if (!loginModalInstance && typeof bootstrap !== 'undefined') {
        console.log("[showLoginModal] Creating new bootstrap modal instance.");
        loginModalInstance = new bootstrap.Modal(loginModalElement);
    }
    if (loginModalInstance) {
        console.log("[showLoginModal] Showing modal via bootstrap instance.");
        loginModalInstance.show();
    } else if (loginModalElement) {
        console.warn("Bootstrap modal instance not available, using basic show.");
        loginModalElement.style.display = 'block'; // 或 'flex'
    }
}

// Utility function to hide the login modal (无变化)
function hideLoginModal() {
    console.log("[hideLoginModal] Attempting to hide login modal.");
    if (loginModalInstance) {
        console.log("[hideLoginModal] Hiding modal via bootstrap instance.");
        loginModalInstance.hide();
    } else {
        const loginModalElement = document.getElementById('loginModal');
        if (loginModalElement) {
            loginModalElement.style.display = 'none';
        } else {
             console.warn("Could not find loginModal element to hide.");
        }
    }
}

// **** 新增：绑定忘记密码链接事件 ****
async function handleForgotPassword(event) {
    if (event) event.preventDefault();
    console.log("[handleForgotPassword] Password reset process started.");
    const emailInput = document.getElementById('loginEmail');
    const errorAlert = document.getElementById('authErrorAlert');

    // 清除旧错误
    if (errorAlert) errorAlert.classList.add('d-none');

    if (!emailInput) {
        console.error("[handleForgotPassword] Email input element not found.");
        showAuthError('请输入邮箱地址！');
        return;
    }

    const email = emailInput.value.trim();

    if (!email) {
        showAuthError('请输入邮箱地址！');
        return;
    }

    console.log(`[handleForgotPassword] Attempting password reset for email: ${email}`);

    try {
        await AV.User.requestPasswordReset(email);
        console.log("[handleForgotPassword] Password reset request successful.");
        alert('密码重置链接已发送至您的邮箱。请检查您的邮箱并按照说明重置密码。');
        hideLoginModal();
    } catch (error) {
        console.error("请求密码重置失败:", error);
        // 根据 LeanCloud 的错误码提供更具体的提示
        if (error.code === 205) { // User not found
            showAuthError('该邮箱地址未注册。');
        } else {
            showAuthError(`请求密码重置失败: ${error.message}`);
        }
    }
}
// **** 结束新增 ****

// ... (确保文件末尾没有遗漏其他代码) ... 