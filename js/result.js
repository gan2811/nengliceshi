// 全局变量存储当前结果，方便复用
let currentResultData = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadResultData();
});

// 加载并显示结果数据
function loadResultData() {
    const urlParams = new URLSearchParams(window.location.search);
    const assessmentId = urlParams.get('assessmentId');

    if (!assessmentId) {
        displayError("未找到测评 ID。");
        return;
    }

    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    // 使用非严格比较 (==) 以防类型不匹配
    const record = history.find(r => r.id == assessmentId);

    if (!record) {
        displayError(`未找到 ID 为 ${assessmentId} 的测评记录。`);
        return;
    }

    // 检查必要的数据结构
    if (!record.userInfo || !record.score || !record.questions || !record.answers) {
         displayError(`测评记录 (ID: ${assessmentId}) 数据结构不完整，无法显示结果。`);
         console.error("Incomplete record data:", record);
         return;
    }

    // 填充基本信息
    document.getElementById('userName').textContent = record.userInfo.name || '未知';
    document.getElementById('employeeId').textContent = record.userInfo.employeeId || '未知'; // 使用 employeeId
    document.getElementById('station').textContent = getStationName(record.userInfo.station); // 使用 getStationName
    document.getElementById('position').textContent = getPositionName(record.position || record.userInfo.position); // 使用 getPositionName
    document.getElementById('assessorName').textContent = record.assessor || '未记录'; // 读取 assessor
    document.getElementById('assessmentTimestamp').textContent = formatDate(record.timestamp || record.endTime, true); // 使用带时间的格式
    
    let durationText = 'N/A';
    if (record.duration !== undefined) {
        const hours = Math.floor(record.duration / 60);
        const minutes = record.duration % 60;
        durationText = '';
        if (hours > 0) durationText += `${hours}小时 `;
        if (minutes > 0 || hours === 0) durationText += `${minutes}分钟`;
        if (durationText === '') durationText = '0分钟';
    }
    document.getElementById('assessmentDuration').textContent = durationText;

    // 填充得分信息 (使用嵌套 score 对象)
    document.getElementById('totalScore').textContent = record.score.totalScore !== undefined ? record.score.totalScore : 'N/A';
    document.getElementById('standardScore').textContent = record.score.maxScore !== undefined ? record.score.maxScore : 'N/A'; // 使用 maxScore
    document.getElementById('scoreRate').textContent = record.score.scoreRate !== undefined ? `${record.score.scoreRate}%` : 'N/A';

    // 填充题目详情
    generateQuestionDetailsTable(record);
}

// 生成题目详情表格 HTML
function generateQuestionDetailsTable(record) {
    const tbody = document.getElementById('questionDetailsTableBody');
    tbody.innerHTML = ''; // 清空现有内容

    if (!record.questions || record.questions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">本次测评无题目详情。</td></tr>';
        return;
    }

    record.questions.forEach((question, index) => {
        const answer = record.answers[question.id] || { score: null, comment: '', duration: null };
        const durationText = (answer.duration !== undefined && answer.duration !== null) ? `${answer.duration} 秒` : 'N/A';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${question.content || '无题目内容'}</td>
            <td>${question.standardScore !== null ? question.standardScore : 'N/A'}</td>
            <td>${answer.score !== null ? answer.score : '未评分'}</td>
            <td>${durationText}</td>
            <td>${answer.comment || '无'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 显示错误信息
function displayError(message) {
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

// **** 新增：获取车站名称 ****
function getStationName(stationCode) {
    const stationMap = {
        'grand_hall': '大礼堂',
        'seven_hills': '七星岗',
        'houbao': '后堡',
        'wanshou': '万寿路',
        'nanhu': '南湖',
        'lanhua': '兰花路'
        // Add more stations if needed
    };
    return stationMap[stationCode] || stationCode || '未知'; // Return name, code, or '未知'
}

// 获取岗位名称 (需要与 main.js 或 history.js 保持一致)
function getPositionName(positionCode) {
    const positionMap = {
        'duty_station': '值班站长',
        'station_duty': '车站值班员',
        'station_safety': '站务安全员'
        // 在这里可以根据需要添加更多岗位
    };
    // 也处理中文名称直接传入的情况
    if (['值班站长', '车站值班员', '站务安全员'].includes(positionCode)) {
        return positionCode;
    }
    return positionMap[positionCode] || positionCode || '未知'; // 如果找不到映射，返回原始代码或'未知'
}

// 格式化日期 (需要与 main.js 或 history.js 保持一致)
function formatDate(dateString, includeTime = false) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        if (includeTime) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0'); // 通常结果页不需要秒
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } else {
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        console.error("日期格式化错误:", e);
        return dateString; // Fallback
    }
}

// 跳转到数据分析页面，并预选当前员工和测评
function goToAnalysis() {
     const urlParams = new URLSearchParams(window.location.search);
     const assessmentId = urlParams.get('assessmentId');
     const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
     const record = history.find(r => r.id == assessmentId);

     if (record && record.userInfo && record.userInfo.employeeId) {
         const employeeId = record.userInfo.employeeId;
         // 跳转并传递参数
         window.location.href = `analysis.html?employeeId=${encodeURIComponent(employeeId)}&assessmentId=${encodeURIComponent(assessmentId)}`;
     } else {
         // 如果找不到记录或员工ID，则直接跳转到分析页面
         console.warn("无法获取当前测评的员工ID，将直接跳转到分析页面。");
         window.location.href = 'analysis.html';
     }
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