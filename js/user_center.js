document.addEventListener('DOMContentLoaded', () => {
    console.log("--- user_center.js loaded ---");
    const userInfoDisplay = document.getElementById('userInfoDisplay');
    const loggedOutMessage = document.getElementById('loggedOutMessage');
    const userIdentifier = document.getElementById('userIdentifier');
    const userObjectId = document.getElementById('userObjectId');
    const userCreatedAt = document.getElementById('userCreatedAt');
    const userUpdatedAt = document.getElementById('userUpdatedAt');
    const logoutButton = document.getElementById('logoutButton');
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    const changePasswordButton = document.getElementById('changePasswordButton');
    const passwordChangeAlert = document.getElementById('passwordChangeAlert');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

    const currentUser = AV.User.current();

    if (currentUser) {
        console.log("User is logged in, displaying info.");
        userInfoDisplay.style.display = 'block';
        loggedOutMessage.style.display = 'none';

        // 优先显示邮箱，其次是用户名
        userIdentifier.textContent = currentUser.getEmail() || currentUser.getUsername();
        userObjectId.textContent = currentUser.getObjectId();
        userCreatedAt.textContent = currentUser.getCreatedAt() ? currentUser.getCreatedAt().toLocaleString('zh-CN') : 'N/A';
        userUpdatedAt.textContent = currentUser.getUpdatedAt() ? currentUser.getUpdatedAt().toLocaleString('zh-CN') : 'N/A';

        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                console.log("Logout button clicked.");
                try {
                    await AV.User.logOut();
                    alert('已成功退出登录。');
                    window.location.href = 'index.html'; // Redirect to homepage after logout
                } catch (error) {
                    console.error('Logout failed:', error);
                    alert('退出登录失败。');
                }
            });
        } else {
            console.warn("Logout button not found.");
        }
        
        // **** 新增：处理密码修改表单提交 ****
        if (passwordChangeForm) {
            passwordChangeForm.addEventListener('submit', handleChangePassword);
        } else {
             console.warn("Password change form not found.");
        }
        // **** 结束新增 ****

    } else {
        console.log("User is not logged in.");
        userInfoDisplay.style.display = 'none';
        loggedOutMessage.style.display = 'block';
    }
});

// **** 新增：处理密码修改逻辑 ****
async function handleChangePassword(event) {
    event.preventDefault(); // 阻止表单默认提交
    console.log("Password change form submitted.");

    const passwordChangeAlert = document.getElementById('passwordChangeAlert');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const changePasswordButton = document.getElementById('changePasswordButton');
    
    // 重置提示信息
    passwordChangeAlert.classList.add('d-none');
    passwordChangeAlert.classList.remove('alert-success', 'alert-danger');
    passwordChangeAlert.textContent = '';

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    // 输入验证
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showPasswordAlert('所有密码字段均不能为空。', 'danger');
        return;
    }
    if (newPassword.length < 6) {
        showPasswordAlert('新密码长度不能少于 6 位。', 'danger');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showPasswordAlert('新密码和确认密码不一致。', 'danger');
        return;
    }
    if (currentPassword === newPassword) {
        showPasswordAlert('新密码不能与当前密码相同。', 'danger');
        return;
    }

    const currentUser = AV.User.current();
    if (!currentUser) {
        showPasswordAlert('用户未登录，无法修改密码。', 'danger');
        return;
    }

    // 禁用按钮
    changePasswordButton.disabled = true;
    changePasswordButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 处理中...';

    try {
        console.log("Calling AV.User.updatePassword...");
        await currentUser.updatePassword(currentPassword, newPassword);
        console.log("Password updated successfully.");
        showPasswordAlert('密码修改成功！', 'success');
        // 清空表单
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
    } catch (error) {
        console.error('Error updating password:', error);
        let message = '密码修改失败，请稍后重试。';
        if (error.code === 210) { // Incorrect old password
            message = '当前密码不正确。';
        }
        showPasswordAlert(message, 'danger');
    } finally {
        // 恢复按钮
        changePasswordButton.disabled = false;
        changePasswordButton.innerHTML = '<i class="bi bi-key me-2"></i>确认修改';
    }
}

// **** 新增：显示密码修改提示的辅助函数 ****
function showPasswordAlert(message, type = 'danger') {
    const passwordChangeAlert = document.getElementById('passwordChangeAlert');
    if (passwordChangeAlert) {
        passwordChangeAlert.textContent = message;
        passwordChangeAlert.classList.remove('d-none', 'alert-success', 'alert-danger');
        passwordChangeAlert.classList.add(`alert-${type}`);
    }
} 