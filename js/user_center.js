document.addEventListener('DOMContentLoaded', function() {
    console.log("[user_center.js] DOMContentLoaded");
    const userInfoDisplay = document.getElementById('userInfoDisplay');
    const userActions = document.getElementById('userActions');
    const loggedOutMessage = document.getElementById('loggedOutMessage');
    const logoutButton = document.getElementById('logoutButton');
    const userIdentifierSpan = document.getElementById('userIdentifier');
    const userObjectIdSpan = document.getElementById('userObjectId');
    const userCreatedAtSpan = document.getElementById('userCreatedAt');
    const userUpdatedAtSpan = document.getElementById('userUpdatedAt');

    // 再次检查 currentUser (main.js 应该已经初始化了)
    if (typeof AV === 'undefined' || !AV.User) {
        console.error("[user_center.js] LeanCloud SDK not loaded.");
        if (loggedOutMessage) {
            loggedOutMessage.textContent = '系统错误：无法加载用户信息。';
            loggedOutMessage.style.display = 'block';
        }
        return;
    }

    const currentUser = AV.User.current();

    if (currentUser) {
        console.log("[user_center.js] User is logged in:", currentUser.getUsername());
        // 用户已登录，显示信息和操作
        if (userInfoDisplay) userInfoDisplay.style.display = 'block';
        if (userActions) userActions.style.display = 'block';
        if (loggedOutMessage) loggedOutMessage.style.display = 'none';

        // 填充用户信息
        if (userIdentifierSpan) {
            // 优先显示 name，其次 email，最后 username
            userIdentifierSpan.textContent = currentUser.get('name') || currentUser.getEmail() || currentUser.getUsername() || 'N/A';
        }
        if (userObjectIdSpan) userObjectIdSpan.textContent = currentUser.id || 'N/A';
        if (userCreatedAtSpan) userCreatedAtSpan.textContent = currentUser.createdAt ? formatDate(currentUser.createdAt, true) : 'N/A';
        if (userUpdatedAtSpan) userUpdatedAtSpan.textContent = currentUser.updatedAt ? formatDate(currentUser.updatedAt, true) : 'N/A';


        // 绑定登出按钮事件
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                console.log("[user_center.js] Logout button clicked.");
                try {
                    await AV.User.logOut();
                    console.log("[user_center.js] Logout successful.");
                    // 清除可能存在的本地测评状态
                    localStorage.removeItem('activeAssessmentState'); 
                    window.location.href = 'index.html'; // 重定向到首页
                } catch (error) {
                    console.error("[user_center.js] Logout failed:", error);
                    alert('退出登录失败: ' + error.message);
                }
            });
        }

    } else {
        console.log("[user_center.js] User is not logged in.");
        // 用户未登录，显示提示信息
        if (userInfoDisplay) userInfoDisplay.style.display = 'none';
        if (userActions) userActions.style.display = 'none';
        if (loggedOutMessage) loggedOutMessage.style.display = 'block';
    }

    // 需要 formatDate 函数，如果 main.js 没有全局暴露，可以在这里复制一份
    function formatDate(dateInput, includeTime = false) {
        let dateObject;
        if (dateInput instanceof Date) {
            dateObject = dateInput;
        } else if (typeof dateInput === 'string') {
            dateObject = new Date(dateInput);
        } else {
            return 'N/A';
        }
        if (!dateObject || isNaN(dateObject.getTime())) return 'N/A';
        try {
            const year = dateObject.getFullYear();
            const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
            const day = dateObject.getDate().toString().padStart(2, '0');
            if (includeTime) {
                const hours = dateObject.getHours().toString().padStart(2, '0');
                const minutes = dateObject.getMinutes().toString().padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            } else {
                return `${year}-${month}-${day}`;
            }
        } catch (e) {
            console.error("日期格式化错误:", e, "Input:", dateInput);
            return '日期错误';
        }
    }
}); 