// 全局变量存储从云端获取的结果，方便复用
let currentCloudAssessment = null;
let currentCloudDetails = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 确保 LeanCloud SDK 已初始化 (应该在 main.js 中完成，这里加个检查)
    if (typeof AV === 'undefined') {
        displayError("LeanCloud SDK 未加载，请检查 HTML 文件。");
        return;
    }
    loadResultDataFromCloud();
});

// **** 重写：从 LeanCloud 加载并显示结果数据 ****
async function loadResultDataFromCloud() {
    const urlParams = new URLSearchParams(window.location.search);
    const assessmentId = urlParams.get('assessmentId'); // 这个 ID 是 Assessment 表的 objectId

    if (!assessmentId) {
        displayError("URL 中未找到有效的测评 ID (assessmentId)。");
        return;
    }

    // 显示加载状态 (可选)
    displayLoading("正在加载测评结果...");

    try {
        // 1. 查询 Assessment 表
        const query = new AV.Query('Assessment');
        query.include('userPointer'); // 同时加载关联的 UserProfile 数据
        const assessment = await query.get(assessmentId);
        currentCloudAssessment = assessment; // 保存到全局变量

        // 2. 填充基本信息和得分信息
        populateBasicInfo(assessment);
        populateScoreInfo(assessment);

        // 3. 查询并填充题目详情
        await loadAndDisplayDetails(assessment);

        // 移除加载状态
        removeLoading();

    } catch (error) {
        console.error("从 LeanCloud 加载测评结果失败:", error);
        if (error.code === 101) { // Object not found.
             displayError(`未在云端找到 ID 为 ${assessmentId} 的测评记录。请确认 ID 是否正确，或稍后再试。`);
        } else {
            displayError(`加载测评结果时出错: ${error.message || '未知错误'}`);
        }
        removeLoading(); // 同样移除加载状态
    }
}

// **** 新增：填充基本信息 ****
function populateBasicInfo(assessment) {
    const userInfo = assessment.get('userPointer'); // 获取关联的 UserProfile 对象
    document.getElementById('userName').textContent = userInfo ? userInfo.get('name') : '未知';
    document.getElementById('employeeId').textContent = userInfo ? userInfo.get('employeeId') : '未知';
    document.getElementById('station').textContent = userInfo ? getStationName(userInfo.get('stationCode')) : '未知';
    document.getElementById('position').textContent = getPositionName(assessment.get('positionCode'));
    document.getElementById('assessorName').textContent = assessment.get('assessorName') || '未记录';
    document.getElementById('assessmentTimestamp').textContent = formatDate(assessment.get('endTime'), true);

    // 计算时长
    let durationText = 'N/A';
    const totalSeconds = assessment.get('totalActiveSeconds');
    if (totalSeconds !== undefined && totalSeconds !== null) {
        if (totalSeconds < 60) {
            durationText = `${totalSeconds}秒`;
        } else {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            durationText = `${minutes}分`;
            if (seconds > 0) {
                durationText += ` ${seconds}秒`;
            }
        }
    } else { // Fallback if totalActiveSeconds is missing
         const minutes = assessment.get('durationMinutes');
         if (minutes !== undefined && minutes !== null) {
             durationText = `${minutes}分钟`;
         }
    }
    document.getElementById('assessmentDuration').textContent = durationText;
}

// **** 新增：填充得分信息 ****
function populateScoreInfo(assessment) {
    document.getElementById('totalScore').textContent = assessment.get('totalScore') !== undefined ? assessment.get('totalScore') : 'N/A';
    document.getElementById('standardScore').textContent = assessment.get('maxPossibleScore') !== undefined ? assessment.get('maxPossibleScore') : 'N/A';
    const scoreRate = assessment.get('scoreRate');
    document.getElementById('scoreRate').textContent = scoreRate !== undefined && scoreRate !== null ? `${scoreRate}%` : 'N/A';
}

// **** 新增：加载并显示题目详情 ****
async function loadAndDisplayDetails(assessmentObject) {
    const query = new AV.Query('AssessmentDetail');
    // 查询所有 assessmentPointer 指向当前 Assessment 记录的详情
    query.equalTo('assessmentPointer', assessmentObject);
    // 可以根据需要添加排序，例如按 questionId 或 createdAt
    // query.addAscending('createdAt');
    query.limit(1000); // 设置查找上限，防止数据过多

    try {
        const details = await query.find();
        currentCloudDetails = details; // 保存到全局变量
        generateQuestionDetailsTable(details);
    } catch (error) {
        console.error("加载题目详情失败:", error);
        const tbody = document.getElementById('questionDetailsTableBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">加载题目详情失败。</td></tr>';
    }
}

// **** 修改：使用从云端获取的 AssessmentDetail 对象生成表格 ****
function generateQuestionDetailsTable(details) {
    const tbody = document.getElementById('questionDetailsTableBody');
    tbody.innerHTML = ''; // 清空现有内容

    if (!details || details.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">本次测评无题目详情记录。</td></tr>';
        return;
    }

    // 如果需要按题目顺序显示，可能需要先获取所有题目信息或对 details 排序
    // 简单起见，这里直接按查询结果顺序显示
    details.forEach((detail, index) => {
        const durationSeconds = detail.get('durationSeconds');
        const durationText = (durationSeconds !== undefined && durationSeconds !== null) ? `${durationSeconds} 秒` : 'N/A';
        const score = detail.get('score');
        const scoreText = (score !== undefined && score !== null) ? score : '未评分';
        const standardScore = detail.get('standardScore');
        const standardScoreText = (standardScore !== undefined && standardScore !== null) ? standardScore : 'N/A';
        const comment = detail.get('comment');
        const commentText = comment ? comment : '无';
        const questionContent = detail.get('questionContent') || '无题目内容';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${questionContent}</td>
            <td>${standardScoreText}</td>
            <td>${scoreText}</td>
            <td>${durationText}</td>
            <td>${commentText}</td>
        `;
        tbody.appendChild(tr);
    });
}

// **** 新增：显示加载状态 ****
function displayLoading(message = "加载中...") {
    removeLoading(); // Remove previous loading message if any
    const container = document.querySelector('.container');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.className = 'alert alert-info mt-4';
    loadingDiv.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> ${message}`;
    // 插入到标题下方
    const titleContainer = container.querySelector('.title-container');
    if (titleContainer) {
         titleContainer.parentNode.insertBefore(loadingDiv, titleContainer.nextSibling);
    } else {
        container.insertBefore(loadingDiv, container.firstChild);
    }
}

// **** 新增：移除加载状态 ****
function removeLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

// 显示错误信息
function displayError(message) {
    removeLoading(); // 如果有加载提示，先移除
    const container = document.querySelector('.container');
    if (container) {
        // 移除可能存在的旧错误信息
        const existingAlert = container.querySelector('.alert-danger');
        if(existingAlert) existingAlert.remove();
        // 隐藏主卡片内容
        const card = container.querySelector('.card');
        if(card) card.style.display = 'none';
        // 显示错误信息
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger mt-4';
        errorDiv.setAttribute('role', 'alert');
        errorDiv.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> ${message}`;
        // 插入到标题下方
        const titleContainer = container.querySelector('.title-container');
        if (titleContainer) {
             titleContainer.parentNode.insertBefore(errorDiv, titleContainer.nextSibling);
        } else {
            container.insertBefore(errorDiv, container.firstChild);
        }
    } else {
         alert(message); // Fallback
    }
}

// **** Helper Functions (保持或从 main.js 引入) ****
// 获取车站名称
function getStationName(stationCode) {
    const stationMap = {
        'grand_hall': '大礼堂',
        'seven_hills': '七星岗',
        'houbao': '后堡',
        'wanshou': '万寿路',
        'nanhu': '南湖',
        'lanhua': '兰花路'
    };
    return stationMap[stationCode] || stationCode || '未知';
}

// 获取岗位名称
function getPositionName(positionCode) {
    const positionMap = {
        'duty_station': '值班站长',
        'station_duty': '车站值班员',
        'station_safety': '站务安全员'
    };
    if (['值班站长', '车站值班员', '站务安全员'].includes(positionCode)) {
        return positionCode;
    }
    return positionMap[positionCode] || positionCode || '未知';
}

// 格式化日期
function formatDate(dateObject, includeTime = false) { // 修改为接收 Date 对象
    if (!dateObject || !(dateObject instanceof Date)) return 'N/A';
    try {
        const date = dateObject;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        if (includeTime) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } else {
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        console.error("日期格式化错误:", e);
        return '日期错误'; // Fallback
    }
}

// **** 修改：跳转到数据分析页面 (需要调整) ****
function goToAnalysis() {
     if (currentCloudAssessment && currentCloudAssessment.get('userPointer')) {
         const userProfile = currentCloudAssessment.get('userPointer');
         const employeeId = userProfile.get('employeeId');
         const assessmentObjectId = currentCloudAssessment.id;
         if (employeeId && assessmentObjectId) {
            window.location.href = `analysis.html?employeeId=${encodeURIComponent(employeeId)}&assessmentId=${encodeURIComponent(assessmentObjectId)}`;
            return;
         }
     }
     // Fallback or if data is missing
     console.warn("无法获取当前测评的员工ID或测评ID，将直接跳转到分析页面。");
     window.location.href = 'analysis.html';
}

// 打印样式
const printStyles = `
    @media print {
        .btn {
            display: none;
        }
        .card {
            border: none;
            box-shadow: none;
        }
        .card-header {
            background: none;
            border-bottom: 2px solid #000;
        }
    }
`;

// 添加打印样式
const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet); 