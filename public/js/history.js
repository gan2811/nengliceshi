// 全局变量
let currentPage = 1;
const pageSize = 10;
let filteredRecords = [];
let currentDetailId = null;
let sortColumn = null; // 当前排序的列
let sortDirection = 'desc'; // 当前排序方向: 'asc' 或 'desc'

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadHistoryRecords();
    initializeFilters();

    // **** 新增：模态框关闭后设置焦点 ****
    const detailModalElement = document.getElementById('detailModal');
    const backToIndexBtn = document.getElementById('backToIndexBtn'); // 获取返回按钮

    if (detailModalElement && backToIndexBtn) {
        detailModalElement.addEventListener('hidden.bs.modal', function () {
            // console.log("Detail modal hidden, setting focus to back button."); // 注释掉调试日志
            backToIndexBtn.focus(); // 将焦点设置到返回按钮
        });
    } else {
        console.warn('Could not find detailModal or backToIndexBtn for focus management.');
    }
    // **** 结束新增 ****

    // 新增：绑定上传按钮事件
    const uploadBtn = document.getElementById('uploadHistoryBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadHistoryToLeanCloud);
    }
});

// 初始化筛选器
function initializeFilters() {
    // 设置日期范围默认值
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('startDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];

    // 绑定筛选器事件
    document.getElementById('startDate').addEventListener('change', filterRecords);
    document.getElementById('endDate').addEventListener('change', filterRecords);
    document.getElementById('positionFilter').addEventListener('change', filterRecords);
    document.getElementById('searchInput').addEventListener('input', filterRecords);
}

// 加载历史记录
function loadHistoryRecords() {
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');

    // **** 移除旧的转换逻辑，假设新数据都是嵌套 score 对象 ****
    /*
    const processedHistory = history.map(record => {
        // ... 旧转换代码 ...
        return record;
    });
    */
    // 直接使用原始 history (或添加对旧数据的检查)
    filteredRecords = history;

    // 按得分率排序并计算排名 (使用新结构)
    sortRecords(); // Sort first based on default column

    // **** 注意：不再在这里保存回 localStorage，避免覆盖未处理的旧数据 ****
    // localStorage.setItem('assessmentHistory', JSON.stringify(processedHistory));

    displayRecords();
}

// 筛选记录 (使用新结构)
function filterRecords() {
    // ... (筛选逻辑不变，但排序在后面进行)
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    filteredRecords = history.filter(record => {
        const recordDate = new Date(record.timestamp || record.endTime);
        // Handle potential missing date values more robustly
        const startDateValue = document.getElementById('startDate').value;
        const endDateValue = document.getElementById('endDate').value;
        const startDate = startDateValue ? new Date(startDateValue) : null;
        const endDate = endDateValue ? new Date(endDateValue) : null;
        // Adjust end date to include the whole day
        if (endDate) endDate.setHours(23, 59, 59, 999);

        const position = document.getElementById('positionFilter').value;
        const searchText = document.getElementById('searchInput').value.toLowerCase();

        const dateMatch = (!startDate || recordDate >= startDate) && (!endDate || recordDate <= endDate);
        const positionMatch = !position || (record.userInfo?.position || record.position) === position;
        const searchMatch = !searchText ||
            (record.userInfo?.name?.toLowerCase().includes(searchText)) || // Check name exists
            (record.userInfo?.employeeId?.toLowerCase().includes(searchText)); // Check employeeId exists

        return dateMatch && positionMatch && searchMatch;
    });

    // 筛选后进行排序
    sortRecords();

    currentPage = 1;
    displayRecords();
}

// 显示记录 (使用新结构)
function displayRecords() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageRecords = filteredRecords.slice(start, end);

    // 计算排名 (在排序后调用)
    const rankings = calculateRankings(filteredRecords);

    pageRecords.forEach((record, index) => {
        // **** 使用 totalActiveSeconds 来计算并格式化时长 ****
        let durationText = 'N/A';
        if (record.totalActiveSeconds !== undefined && record.totalActiveSeconds !== null && record.status !== 'paused') {
            const totalSeconds = record.totalActiveSeconds;
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
        } else if (record.status === 'paused') {
            durationText = `<span class="badge bg-warning text-dark">暂存中</span>`;
        }
        // **** 结束时长格式化修改 ****

        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        // **** 使用 record.score?.totalScore 和 record.score?.scoreRate ****
        const totalScore = record.status !== 'paused' ? (record.score?.totalScore !== undefined ? record.score.totalScore : 0) : '-';
        const scoreRate = record.status !== 'paused' ? (record.score?.scoreRate !== undefined ? record.score.scoreRate : 0) : '-';
        const scoreRateBadge = record.status !== 'paused' ? 
            `<span class="badge ${getScoreRateClass(scoreRate)}">${scoreRate}%</span>` : 
            `<span class="badge bg-secondary">-</span>`;

        // **** 根据状态动态生成按钮 ****
        let actionButtons = '';
        if (record.status === 'paused') {
            actionButtons = `
                <button class="btn btn-sm btn-warning" onclick="resumeAssessment('${record.id}')">
                    <i class="bi bi-play-circle me-1"></i>继续测评
                </button>
            `;
        } else {
            actionButtons = `
                <button class="btn btn-sm btn-primary" onclick="showDetail('${record.id}')">
                    <i class="bi bi-eye me-1"></i>查看详情
                </button>
            `;
        }
        // 添加删除按钮
        actionButtons += `
             <button class="btn btn-sm btn-danger ms-1" onclick="deleteHistoryRecord('${record.id}')">
                 <i class="bi bi-trash"></i> 删除
             </button>
        `;

        tr.innerHTML = `
            <td>${start + index + 1}</td>
            <td>${rankings.get(record.id) || 'N/A'}</td>
            <td>${formatDate(record.timestamp || record.endTime)}</td>
            <td>${record.userInfo?.name || '未知'}</td>
            <td>${record.userInfo?.employeeId || '未知'}</td>
            <td>${getPositionName(record.position || record.userInfo?.position)}</td>
            <td>${durationText}</td>
            <td>${totalScore}</td>
            <td>${scoreRateBadge}</td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePagination();
}

// 获取得分率对应的样式类
function getScoreRateClass(scoreRate) {
    if (scoreRate >= 90) return 'bg-success';
    if (scoreRate >= 80) return 'bg-info';
    if (scoreRate >= 60) return 'bg-warning';
    return 'bg-danger';
}

// 更新分页
function updatePagination() {
    const totalPages = Math.ceil(filteredRecords.length / pageSize);
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    // 上一页
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">上一页</a>
    `;
    pagination.appendChild(prevLi);

    // 页码
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${currentPage === i ? 'active' : ''}`;
        li.innerHTML = `
            <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        `;
        pagination.appendChild(li);
    }

    // 下一页
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">下一页</a>
    `;
    pagination.appendChild(nextLi);
}

// 切换页面
function changePage(page) {
    if (page < 1 || page > Math.ceil(filteredRecords.length / pageSize)) return;
    currentPage = page;
    displayRecords();
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

// 获取岗位名称 (保持不变)
function getPositionName(positionCode) {
    const positionMap = {
        'duty_station': '值班站长',
        'station_duty': '车站值班员',
        'station_safety': '站务安全员'
    };
     // 也处理中文名称直接传入的情况
    if (['值班站长', '车站值班员', '站务安全员'].includes(positionCode)) {
        return positionCode;
    }
    return positionMap[positionCode] || positionCode || '未知';
}

// 显示详情 (使用新结构)
function showDetail(id) {
    console.log("Showing detail for ID:", id, typeof id);
    currentDetailId = id; // 保存当前查看的ID
    // 使用非严格比较 (==) 来查找，以防 id 类型不匹配 (string vs number)
    const record = filteredRecords.find(r => r.id == id);
    console.log("Found record:", record);
    
    const modalBody = document.getElementById('detailModalBody');
    if (!modalBody) {
        console.error("无法找到模态框内容区域 #detailModalBody");
        return;
    }

    if (!record) {
        console.error("未找到 ID 为", id, "的记录");
        modalBody.innerHTML = '<div class="alert alert-danger">无法加载详情，未找到记录。</div>';
        const modal = new bootstrap.Modal(document.getElementById('detailModal'));
        modal.show();
        return;
    }

    // Check for userInfo and score structure
    if (!record.userInfo || !record.score) {
         modalBody.innerHTML = '<p class="text-danger">记录数据不完整，无法显示详情。</p>';
         console.error("Incomplete record data for detail view:", record);
         const modal = new bootstrap.Modal(document.getElementById('detailModal'));
         modal.show();
         return;
    }

    // **** 使用 record.score 对象 ****
    const totalScore = record.score?.totalScore !== undefined ? record.score.totalScore : 0;
    const standardScore = record.score?.maxScore !== undefined ? record.score.maxScore : 0; // Use maxScore from score object
    const scoreRate = record.score?.scoreRate !== undefined ? record.score.scoreRate : 0;

    modalBody.innerHTML = `
        <!-- 基本信息 -->
        <div class="mb-4 fade-in">
            <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-person-lines-fill me-2"></i>基本信息</h6>
            <div class="row">
                <div class="col-md-3">
                    <p><strong><i class="bi bi-person me-2"></i>姓名:</strong> ${record.userInfo?.name || '未知'}</p>
                </div>
                <div class="col-md-3">
                    <p><strong><i class="bi bi-person-badge me-2"></i>工号:</strong> ${record.userInfo?.employeeId || '未知'}</p>
                </div>
                <div class="col-md-3">
                    <!-- **** 调用正确的函数获取车站名称 **** -->
                    <p><strong><i class="bi bi-building me-2"></i>所属车站:</strong> ${getStationName(record.userInfo?.station)}</p>
                </div>
                <div class="col-md-3">
                    <p><strong><i class="bi bi-briefcase me-2"></i>岗位:</strong> ${getPositionName(record.position || record.userInfo?.position)}</p>
                </div>
            </div>
            <div class="row mt-2">
                 <div class="col-md-4">
                    <p><strong><i class="bi bi-stopwatch me-2"></i>测评用时:</strong> ${record.duration !== undefined ? record.duration + ' 分钟' : 'N/A'}</p>
                </div>
                <div class="col-md-4">
                     <p><strong><i class="bi bi-person-check-fill me-2"></i>测评人:</strong> ${record.assessor || '未记录'}</p>
                 </div>
                 <div class="col-md-4">
                    <p><strong><i class="bi bi-calendar-check me-2"></i>测评时间:</strong> ${formatDate(record.timestamp || record.endTime)}</p>
                </div>
            </div>
        </div>

        <!-- 得分信息 -->
        <div class="mb-4 fade-in">
            <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-graph-up me-2"></i>得分信息</h6>
            <div class="row">
                <div class="col-md-4">
                    <div class="card bg-light shadow-sm">
                        <div class="card-body text-center p-2">
                            <h4 class="text-primary mb-1">${totalScore}</h4>
                            <p class="mb-0 text-muted small">总分</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                     <div class="card bg-light shadow-sm">
                        <div class="card-body text-center p-2">
                            <h4 class="text-success mb-1">${standardScore}</h4>
                            <p class="mb-0 text-muted small">标准分值</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                     <div class="card bg-light shadow-sm">
                        <div class="card-body text-center p-2">
                            <h4 class="text-info mb-1">${scoreRate}%</h4>
                             <p class="mb-0 text-muted small">得分率</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 题目详情 -->
        <div class="fade-in">
            <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-table me-2"></i>题目详情</h6>
             <div class="table-responsive">
                <table class="table table-sm table-bordered table-hover detail-questions-table">
                    <thead>
                        <tr class="table-light">
                            <th scope="col" style="width: 5%;">序号</th>
                            <th scope="col" style="width: 40%;">题目内容</th>
                            <th scope="col" style="width: 10%;">标准分值</th>
                            <th scope="col" style="width: 10%;">得分</th>
                            <th scope="col" style="width: 10%;">用时(秒)</th>
                            <th scope="col" style="width: 25%;">备注</th>
                        </tr>
                    </thead>
                    <tbody id="detailQuestionTableBody">
                        ${generateQuestionDetailsTable(record)} 
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error("无法找到模态框元素 #detailModal");
    }
}

// 生成题目详情表格 HTML (添加用时显示)
function generateQuestionDetailsTable(record) {
    if (!record.questions || !Array.isArray(record.questions) || !record.answers) {
        console.error('题目或答案数据无效:', record);
        return `<tr><td colspan="6"><div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-2"></i>未找到有效的题目或答案数据</div></td></tr>`;
    }

    let tableRowsHtml = '';
    let questionDisplayedCount = 0;
    record.questions.forEach((question, index) => {
        if (!question || !question.id) {
            console.warn('无效的题目数据:', question);
            return;
        }
        const answer = record.answers[question.id];
        if (!answer) {
            console.warn('未找到题目答案:', question.id);
            // 可以选择显示题目但标记无答案，或直接跳过
            return;
        }

        // **** 显示 answer.duration ****
        const duration = (answer && answer.duration !== undefined && answer.duration !== null) ? `${answer.duration} 秒` : 'N/A'; 

        tableRowsHtml += `
            <tr class="fade-in">
                <td>${index + 1}</td>
                <td>${question.content || '无题目内容'}</td>
                <td>${question.standardScore || 'N/A'}</td>
                <td>${answer.score !== null ? answer.score : '未评分'}</td>
                <td>${duration}</td> 
                <td>${answer.comment || '无'}</td>
            </tr>
        `;
        questionDisplayedCount++;
    });

    if (questionDisplayedCount === 0 && record.questions.length > 0) {
        return `<tr><td colspan="6"><div class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i>所有题目均未找到有效答案</div></td></tr>`;
    } else if (record.questions.length === 0) {
        return `<tr><td colspan="6"><div class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i>本次测评无题目详情</div></td></tr>`;
    }
    
    return tableRowsHtml;
}

// 导出详情到 Excel (重构以匹配图片布局)
function exportDetail() {
    if (!currentDetailId) {
        alert("请先查看一条记录的详情再导出。");
        return;
    }

    const record = filteredRecords.find(r => r.id == currentDetailId);
    if (!record) {
        alert("无法找到要导出的记录。");
        return;
    }

    // --- 准备数据 (单一工作表) ---
    const sheetData = [];
    const userName = record.userInfo?.name || record.name || '未知';

    // 1. 标题行
    sheetData.push([`${userName}的测评详情`, null, null, null, null]); // 标题占 A-E 列
    sheetData.push([]); // 空行

    // 2. 基本信息行 1 (合并 A-E)
    const station = record.userInfo?.station || record.station || '未知';
    const position = getPositionName(record.position || record.userInfo?.position);
    const employeeId = record.userInfo?.employeeId || record.employeeId || '未知';
    // 注意：使用多个空格或制表符 \t 来分隔，Excel 中显示效果可能更好
    sheetData.push([ `姓名: ${userName}    所属车站: ${station}    工号: ${employeeId}    岗位: ${position}`, null, null, null, null ]);
    
    // 3. 基本信息行 2 (合并 A-E)
    const assessor = record.assessor || '未记录'; 
    const formattedTime = formatSimpleDateTime(record.timestamp || record.endTime);
    const durationText = record.duration !== undefined ? `${record.duration} 分钟` : 'N/A';
    sheetData.push([ `测评人: ${assessor}    测评时间: ${formattedTime}    测评用时: ${durationText}`, null, null, null, null ]);

    // 4. 得分信息行 (合并 A-E, 使用 Rich Text)
    const totalScore = record.score?.totalScore !== undefined ? record.score.totalScore : 0;
    const standardScore = record.score?.standardScore !== undefined ? record.score.standardScore : 0;
    const scoreRate = record.score?.scoreRate !== undefined ? record.score.scoreRate + '%' : '0%';
    const scoreRichText = {
        t: 'r', // 'r' 表示 Rich Text
        r: [
            { t: `总分: ` }, // 普通文本
            { t: String(totalScore), s: { font: { bold: true, color: { rgb: "FF0000" } } } }, // 加粗红色
            { t: `    标准分值: ${standardScore}    得分率: ${scoreRate}` } // 普通文本
        ],
        // 提供一个纯文本版本的值，用于排序或简单显示
        v: `总分: ${totalScore}    标准分值: ${standardScore}    得分率: ${scoreRate}` 
    };
    sheetData.push([ scoreRichText, null, null, null, null ]);
    sheetData.push([]); // 空行

    // 5. 题目详情表头 (5 列)
    const tableHeader = ["序号", "题目内容", "标准分值", "得分", "评价意见"];
    sheetData.push(tableHeader);

    // 6. 题目详情数据 (5 列)
    if (record.questions && record.answers) {
        record.questions.forEach((q, index) => {
            const answer = record.answers[q.id] || {};
            sheetData.push([
                index + 1,
                q.content || '',
                q.standardScore || 0,
                answer.score !== null ? answer.score : 'N/A',
                answer.comment || '无' 
            ]);
        });
    }

    // --- 创建工作表 --- 
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // --- 定义合并单元格 (A-E 列合并) --- 
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // 标题行 A1:E1
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // 基本信息行1 A3:E3
        { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, // 基本信息行2 A4:E4
        { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }, // 得分信息行 A5:E5
    ];

    // --- 定义列宽 (5 列) --- 
    ws['!cols'] = [
        { wch: 8 },  // 序号 
        { wch: 45 }, // 题目内容 
        { wch: 10 }, // 标准分值 
        { wch: 8 },  // 得分 
        { wch: 25 }  // 评价意见
    ];

    // --- 定义样式 --- 
    const wrapTextColumns = [1, 4]; // 题目内容(1), 评价意见(4) 需要换行
    const centerAlignColumns = [0, 2, 3]; // 序号, 标准分, 得分 需要居中
    const infoRowStartIndex = 2; 
    const infoRowEndIndex = 4; 
    const tableHeaderRowIndex = 6;
    const tableDataStartIndex = 7;

    const titleStyle = { font: { sz: 16, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const infoStyle = { font: { sz: 10 }, alignment: { vertical: "center", horizontal: "left", wrapText: true } }; // 信息行默认左对齐, 允许换行
    const tableHeaderStyle = { font: { bold: true, sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const tableCellStyle = { font: { sz: 10 }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { vertical: "center" } };

    // 应用样式
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            let cell = ws[cell_ref];
            if (!cell) continue; 
            if (!cell.s) cell.s = {}; // 确保样式对象存在

            // 特定行/列样式覆盖
            if (R === 0) { // 标题行
                cell.s = { ...titleStyle };
            } else if (R >= infoRowStartIndex && R <= infoRowEndIndex) { // 信息行 (A列合并单元格)
                if (C === 0) { // 只对合并后的第一个单元格应用样式
                    cell.s = { ...infoStyle, ...cell.s }; // 应用信息行样式
                } else {
                     cell.s = {}; // 清空其他被合并单元格的默认边框样式等
                }
            } else if (R === tableHeaderRowIndex) { // 表格标题行
                 if (C <= 4) { // 只对前5列应用表头样式
                     cell.s = { ...tableHeaderStyle, ...cell.s };
                 }
            } else if (R >= tableDataStartIndex) { // 表格数据行
                 if (C <= 4) { // 只对前5列应用表格样式
                     cell.s = { ...tableCellStyle, ...cell.s }; // 先应用表格单元格样式（带边框）
                     cell.s.alignment = { ...cell.s.alignment, vertical: "center" }; // 确保垂直居中
                     // 设置文本换行
                     if (wrapTextColumns.includes(C)) {
                        cell.s.alignment = { ...cell.s.alignment, wrapText: true };
                     }
                     // 设置水平居中
                     if (centerAlignColumns.includes(C)) {
                        cell.s.alignment = { ...cell.s.alignment, horizontal: "center" };
                     } else {
                         cell.s.alignment = { ...cell.s.alignment, horizontal: "left" }; // 其他列左对齐
                     }
                 } else {
                      cell.s = {}; // 清空表格外单元格的样式
                 }
            }
        }
    }

    // --- 创建工作簿并添加工作表 ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "测评详情"); // 单一工作表

    // --- 生成文件名并导出 ---
    const timestamp = formatDate(record.timestamp || record.endTime, true); // 使用带时间的格式
    const filename = `${userName}的测评详情_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// **** 修改 formatSimpleDateTime 为更易读的格式 ****
function formatSimpleDateTime(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
           // second: '2-digit' // Optional: include seconds
        }).replace(/\//g, '-'); // Replace slashes if locale uses them
    } catch (e) {
        console.error("日期格式化错误:", e);
        return isoString; 
    }
}

// 计算分数
function calculateScore(assessmentData) {
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    if (!assessmentData || !assessmentData.questions || !assessmentData.answers) {
        console.error("计算分数时数据无效");
        return { finalScore: 0, totalAchieved: 0, maxPossible: 0 };
    }

    assessmentData.questions.forEach(q => {
        const answer = assessmentData.answers[q.id];
        const questionScore = answer && answer.score !== null ? answer.score : 0;
        const standardScore = q.standardScore || 100;
        
        totalScore += questionScore;
        maxPossibleScore += standardScore;
    });

    return {
        finalScore: maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0,
        totalAchieved: totalScore,
        maxPossible: maxPossibleScore
    };
}

// **** 修改 formatDate 以支持包含时间 ****
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
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        } else {
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        console.error("日期格式化错误:", e);
        return dateString; // Fallback
    }
}

// --- 新增排序功能 ---
// 排序表格
function sortTable(column) {
    // 如果点击的是当前排序列，则切换排序方向
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // 否则，按新列降序排序
        sortColumn = column;
        sortDirection = 'desc'; 
    }

    // 执行排序
    sortRecords();

    // 更新表头图标
    updateSortIcons();

    // 重新显示记录
    currentPage = 1; // 回到第一页
    displayRecords();
}

// 对记录进行排序
function sortRecords() {
    const rankings = calculateRankings(filteredRecords); // 获取原始排名

    filteredRecords.sort((a, b) => {
        let valA, valB;

        switch (sortColumn) {
            case 'rank':
                valA = rankings.get(a.id);
                valB = rankings.get(b.id);
                break;
            case 'timestamp':
                valA = new Date(a.timestamp || a.endTime);
                valB = new Date(b.timestamp || b.endTime);
                break;
            case 'totalScore':
                // **** 使用嵌套结构 ****
                valA = a.score?.totalScore !== undefined ? a.score.totalScore : -Infinity;
                valB = b.score?.totalScore !== undefined ? b.score.totalScore : -Infinity;
                break;
            case 'scoreRate':
                 // **** 使用嵌套结构 ****
                valA = a.score?.scoreRate !== undefined ? a.score.scoreRate : -Infinity;
                valB = b.score?.scoreRate !== undefined ? b.score.scoreRate : -Infinity;
                break;
            default:
                return 0; // 如果列无效，不排序
        }

        if (valA < valB) {
            return sortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortDirection === 'asc' ? 1 : -1;
        }
        // 如果值相等，可以添加次要排序规则，例如按时间
        if (sortColumn !== 'timestamp') {
            const timeA = new Date(a.timestamp || a.endTime);
            const timeB = new Date(b.timestamp || b.endTime);
            return timeB - timeA; // 默认按时间降序
        }
        return 0;
    });
}

// 更新表头排序图标
function updateSortIcons() {
    const headers = ['rank', 'timestamp', 'totalScore', 'scoreRate'];
    headers.forEach(header => {
        const thElement = document.getElementById(`th-${header}`);
        if (!thElement) return;
        const icon = thElement.querySelector('i');
        if (!icon) return;

        // 移除现有排序图标类
        icon.classList.remove('bi-arrow-down-up', 'bi-arrow-down', 'bi-arrow-up');

        // 添加新图标类
        if (sortColumn === header) {
            icon.classList.add(sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down');
        } else {
            icon.classList.add('bi-arrow-down-up');
        }
    });
}

// 计算排名 (从 displayRecords 中提取并修改)
function calculateRankings(records) {
    const rankings = new Map();
    // 先按默认规则（得分率、总分、时间）排序以确定基础排名
    const sortedForRank = [...records].sort((a, b) => {
        // **** 使用嵌套结构 ****
        const scoreRateDiff = (b.score?.scoreRate || 0) - (a.score?.scoreRate || 0);
        if (scoreRateDiff !== 0) return scoreRateDiff;
        // **** 使用嵌套结构 ****
        const totalScoreDiff = (b.score?.totalScore || 0) - (a.score?.totalScore || 0);
        if (totalScoreDiff !== 0) return totalScoreDiff;
        return new Date(b.timestamp || b.endTime) - new Date(a.timestamp || a.endTime);
    });

    sortedForRank.forEach((record, index) => {
        if (index === 0) {
            rankings.set(record.id, 1);
        } else {
            const prevRecord = sortedForRank[index - 1];
            // **** 使用嵌套结构 ****
            if ((record.score?.scoreRate || 0) === (prevRecord.score?.scoreRate || 0) &&
                (record.score?.totalScore || 0) === (prevRecord.score?.totalScore || 0)) {
                rankings.set(record.id, rankings.get(prevRecord.id));
            } else {
                rankings.set(record.id, index + 1);
            }
        }
    });
    return rankings;
}

// **** 新增：删除历史记录 ****
function deleteHistoryRecord(id) {
     if (!confirm('确定要删除这条历史记录吗？此操作不可恢复。')) return;

     console.log("Deleting record with ID:", id);
     const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
     const initialLength = history.length;
     const newHistory = history.filter(record => record.id != id); // Use non-strict comparison

     if (newHistory.length < initialLength) {
         localStorage.setItem('assessmentHistory', JSON.stringify(newHistory));
         console.log("Record deleted. Reloading history...");
         // 重新加载并筛选，以反映删除
         loadHistoryRecords(); // Re-load all data
         // filterRecords(); // Or just re-filter and display if loadHistoryRecords does too much
     } else {
         console.warn("Could not find record to delete with ID:", id);
         alert("未找到要删除的记录。");
     }
}

// **** 新增：导出历史记录列表 ****
function exportHistoryList() {
    console.log("[exportHistoryList] 开始导出当前列表...");

    if (!filteredRecords || filteredRecords.length === 0) {
        alert("没有可导出的历史记录。");
        console.log("[exportHistoryList] 没有找到 filteredRecords 数据。");
        return;
    }

    // 准备数据
    const dataToExport = [];
    // 添加表头
    const headers = [
        '序号', '排名', '测评时间', '姓名', '工号',
        '岗位', '测评用时', '总分', '得分率 (%)'
    ];
    dataToExport.push(headers);

    // 重新计算排名（基于当前筛选和排序）
    const rankings = calculateRankings(filteredRecords);

    // 添加数据行
    filteredRecords.forEach((record, index) => {
        // 计算测评用时文本
        let durationText = 'N/A';
        if (record.duration !== undefined) {
            const hours = Math.floor(record.duration / 60);
            const minutes = record.duration % 60;
            durationText = '';
            if (hours > 0) durationText += `${hours}小时`;
            if (minutes > 0 || hours === 0) durationText += `${minutes}分钟`;
            if (durationText === '') durationText = '0分钟';
        }
        
        const row = [
            index + 1, // 当前视图的序号
            rankings.get(record.id) || 'N/A',
            formatDate(record.timestamp || record.endTime), // 格式化日期
            record.userInfo?.name || '未知',
            record.userInfo?.employeeId || '未知',
            getPositionName(record.position || record.userInfo?.position), // 岗位名称
            durationText,
            record.score?.totalScore !== undefined ? record.score.totalScore : 0,
            record.score?.scoreRate !== undefined ? record.score.scoreRate : 0
        ];
        dataToExport.push(row);
    });

    // 创建工作簿和工作表
    const ws_name = "历史记录概览";
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    
    // 设置列宽 (可选)
    const cols = [];
    headers.forEach((h, i) => {
        let width = 15; // Default width
        if (i === 2) width = 20; // 时间列宽一点
        if (i === 5 || i === 6) width = 18; // 岗位和用时宽一点
        cols.push({ wch: width });
    });
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, ws_name);

    // 生成文件名
    const fileName = `岗位胜任力测评_历史记录_${formatDate(new Date(), true)}.xlsx`;

    // 触发下载
    try {
        XLSX.writeFile(wb, fileName);
        console.log(`[exportHistoryList] 成功触发下载: ${fileName}`);
    } catch (error) {
        console.error("[exportHistoryList] 导出 Excel 时出错:", error);
        alert("导出失败，请查看控制台获取更多信息。");
    }
}

// **** 新增：继续测评函数 ****
function resumeAssessment(id) {
    console.log(`Resuming assessment with ID: ${id}`);
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    // 使用非严格比较 (==) 以防类型不匹配
    const assessmentToResume = history.find(record => record.id == id && record.status === 'paused');

    if (assessmentToResume) {
        // 检查是否有正在进行的测评，如果需要，可以提示用户
        if (localStorage.getItem('currentAssessment')) {
            if (!confirm("当前已有正在进行的测评。继续将覆盖当前进度，确定要继续吗？")) {
                return; // 用户取消
            }
        }

        // 将选中的测评记录存入 currentAssessment
        localStorage.setItem('currentAssessment', JSON.stringify(assessmentToResume));
        
        // 从历史记录中移除暂存状态（或者保留，取决于设计）
        // 选项1：移除（测评完成后会重新添加）
        const updatedHistory = history.filter(record => record.id != id);
        localStorage.setItem('assessmentHistory', JSON.stringify(updatedHistory));
        
        // 选项2：保留，但标记为 'resumed' 或类似状态（如果需要追踪）
        // const existingIndex = history.findIndex(record => record.id == id);
        // if (existingIndex > -1) {
        //     history[existingIndex].status = 'resumed'; // Update status
        //     localStorage.setItem('assessmentHistory', JSON.stringify(history));
        // }

        console.log("Assessment data loaded into currentAssessment. Redirecting to assessment page...");
        window.location.href = 'assessment.html'; // 跳转到测评页面
    } else {
        console.error(`无法找到 ID 为 ${id} 的可继续的测评记录。`);
        alert("无法继续测评，记录可能已被删除或状态已改变。");
        loadHistoryRecords(); // 刷新列表以防万一
    }
}

// **** 确保依赖函数存在 ****
// calculateRankings, formatDate, getPositionName 必须在此文件或 main.js 中定义

// 新增：上传历史记录到 LeanCloud
async function uploadHistoryToLeanCloud() {
    const uploadBtn = document.getElementById('uploadHistoryBtn');
    if (!uploadBtn) return;

    if (!confirm("确定要将本地存储的历史记录上传到云端吗？\n这可能需要一些时间，并且只会上传标记为 'completed' 且云端尚不存在的记录。")) {
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 上传中...';

    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    console.log(`[UploadHistory] 开始上传 ${history.length} 条本地记录...`);

    for (const record of history) {
        // **** 修改：允许上传 paused 和 completed 状态 ****
        if (record.status !== 'completed' && record.status !== 'paused') {
            console.log(`[UploadHistory] 跳过记录 ID ${record.id} (状态: ${record.status || 'unknown'})`);
            continue;
        }

        try {
            // 1. 检查云端是否已存在该 assessmentId
            console.log(`[UploadHistory] 检查记录 ID ${record.id}...`);
            const existingQuery = new AV.Query('Assessment');
            existingQuery.equalTo('assessmentId', record.id);
            const count = await existingQuery.count();

            if (count > 0) {
                console.log(`[UploadHistory] 记录 ID ${record.id} 在云端已存在，跳过。`);
                skippedCount++;
                continue;
            }

            console.log(`[UploadHistory] 准备上传记录 ID ${record.id} (状态: ${record.status})...`);
            console.warn("[UploadHistory] 请确保 LeanCloud 的 'Assessment' Class 包含字段: currentQuestionIndex (Number), elapsedSeconds (Number), totalActiveSeconds (Number) 以便正确恢复 paused 记录。");

            // 2. 获取或创建 UserProfile
            const userQuery = new AV.Query('UserProfile');
            const employeeIdStr = record.userInfo.employeeId;
            const employeeIdNum = parseInt(employeeIdStr, 10);

            if (isNaN(employeeIdNum)) {
                 console.error(`[UploadHistory] 记录 ID ${record.id} 的 employeeId '${employeeIdStr}' 无效，跳过此记录。`);
                 failedCount++;
                 continue;
            }

            userQuery.equalTo('employeeId', employeeIdNum);
            let userProfile = await userQuery.first();

            if (!userProfile) {
                userProfile = new AV.Object('UserProfile');
                userProfile.set('employeeId', employeeIdNum);
                userProfile.set('name', record.userInfo.name);
                userProfile.set('stationCode', record.userInfo.station);
                userProfile.set('positionCode', record.userInfo.position);
                // 注意：这里没有设置 ACL，如果需要，需要添加相应逻辑
                userProfile = await userProfile.save();
                console.log(`[UploadHistory] 为记录 ID ${record.id} 创建了新的 UserProfile: ${userProfile.id}`);
            }

            // 3. 创建 Assessment 对象
            const Assessment = AV.Object.extend('Assessment');
            const assessment = new Assessment();
            // 注意：这里没有设置 ACL
            assessment.set('assessmentId', record.id); // 使用本地记录的 ID
            assessment.set('userPointer', AV.Object.createWithoutData('UserProfile', userProfile.id));
            assessment.set('assessorName', record.assessor);
            assessment.set('positionCode', record.position);
            assessment.set('startTime', new Date(record.startTime));
            assessment.set('status', record.status); // **** 使用记录的实际状态 ****

            // **** 根据状态设置不同的字段 ****
            if (record.status === 'completed') {
                // 使用 record.timestamp 作为结束时间 (因为它是完成时的时间戳)
                assessment.set('endTime', new Date(record.timestamp));
                assessment.set('totalActiveSeconds', record.totalActiveSeconds || 0);
                assessment.set('durationMinutes', Math.round((record.totalActiveSeconds || 0) / 60));
                assessment.set('totalScore', record.score.totalScore);
                assessment.set('maxPossibleScore', record.score.maxScore);
                assessment.set('scoreRate', record.score.scoreRate);
                 // 对于 completed 记录，这些字段可以设为 null 或不设置
                 assessment.set('currentQuestionIndex', null);
                 assessment.set('elapsedSeconds', null);
            } else if (record.status === 'paused') {
                // 对于 paused 记录，保存暂停时的状态
                assessment.set('endTime', null); // Paused 记录没有结束时间
                assessment.set('totalActiveSeconds', record.totalActiveSeconds || 0); // 保存已累计的活动时间
                assessment.set('durationMinutes', Math.round((record.totalActiveSeconds || 0) / 60)); // 当前累计分钟数
                assessment.set('currentQuestionIndex', record.currentQuestionIndex || 0); // 保存暂停时的题目索引
                assessment.set('elapsedSeconds', record.elapsedSeconds || 0); // 保存暂停时的总流逝秒数
                // Paused 记录没有最终分数
                assessment.set('totalScore', null);
                assessment.set('maxPossibleScore', null);
                assessment.set('scoreRate', null);
            }

            const savedAssessment = await assessment.save();
            console.log(`[UploadHistory] 记录 ID ${record.id} (状态: ${record.status}) 的 Assessment 已保存: ${savedAssessment.id}`);

            // 4. 创建 AssessmentDetail 对象数组
            const AssessmentDetail = AV.Object.extend('AssessmentDetail');
            const detailObjects = [];
            const questions = record.questions || [];
            const answers = record.answers || {};

            questions.forEach(question => {
                const answer = answers[question.id];
                // 对于 paused 记录，answer 可能不存在或 score 为 null
                // 但我们仍然保存题目信息和已有的答案数据
                const detail = new AssessmentDetail();
                 // 注意：这里没有设置 ACL
                detail.set('assessmentPointer', AV.Object.createWithoutData('Assessment', savedAssessment.id));
                detail.set('questionId', question.id);
                detail.set('questionContent', question.content);
                detail.set('standardScore', question.standardScore);
                detail.set('section', question.section);
                detail.set('type', question.type);
                detail.set('knowledgeSource', question.knowledgeSource);
                detail.set('score', answer?.score); // 保存分数 (可能为 null)
                detail.set('comment', answer?.comment || ''); // 保存评论
                detail.set('durationSeconds', Number(answer?.duration || 0)); // 保存用时
                detailObjects.push(detail);
            });

            // 5. 批量保存 AssessmentDetail 对象
            if (detailObjects.length > 0) {
                await AV.Object.saveAll(detailObjects);
                console.log(`[UploadHistory] 记录 ID ${record.id} 的 ${detailObjects.length} 个 AssessmentDetails 已保存。`);
            }

            successCount++;
            console.log(`[UploadHistory] 记录 ID ${record.id} 上传成功。`);

        } catch (error) {
            console.error(`[UploadHistory] 处理记录 ID ${record.id} 时出错:`, error);
            failedCount++;
        }
    }

    console.log(`[UploadHistory] 上传完成: ${successCount} 成功, ${skippedCount} 跳过 (已存在), ${failedCount} 失败。`);
    alert(`上传完成！\n成功: ${successCount}\n跳过 (已存在): ${skippedCount}\n失败: ${failedCount}\n\n请检查控制台获取详细错误信息。`);

    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<i class="bi bi-cloud-upload me-1"></i> 上传历史记录到云端';
}