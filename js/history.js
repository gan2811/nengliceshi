// 全局变量
let currentPage = 1;
const recordsPerPage = 10; // 每页显示多少条记录
let currentSortColumn = 'timestamp'; // 默认排序字段
let currentSortOrder = 'desc'; // 默认排序顺序 (desc: 降序, asc: 升序)
let totalRecords = 0; // 总记录数
let currentFilters = {}; // 存储当前筛选条件
let localUnsyncedRecords = []; // 存储找到的本地未同步记录

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查 LeanCloud SDK
    if (typeof AV === 'undefined') {
        displayError("LeanCloud SDK 未加载，请检查 HTML 文件。");
        return;
    }

    // 绑定筛选和搜索事件
    document.getElementById('startDate').addEventListener('change', applyFiltersAndLoad);
    document.getElementById('endDate').addEventListener('change', applyFiltersAndLoad);
    document.getElementById('positionFilter').addEventListener('change', applyFiltersAndLoad);
    // 搜索按钮绑定 (假设 HTML 中搜索按钮 onclick 调用 searchRecords)
    // 如果搜索是实时触发，可以用 'input' 事件代替
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchRecords();
        }
    });
    
    // 绑定表头点击排序事件 (需要确保 HTML 中 th 有 onclick)
    // 示例: <th onclick="sortTable('timestamp')">测评时间</th>

    // 绑定"从云端下载/刷新"按钮事件 (替换之前的清空按钮)
    const refreshBtn = document.getElementById('downloadFromCloudBtn'); // 使用新按钮ID
    if (refreshBtn) {
        refreshBtn.textContent = '刷新云端记录'; // 更新按钮文本
         refreshBtn.onclick = () => loadHistoryFromCloud(1); // 点击时加载第一页
         refreshBtn.classList.remove('btn-info'); // 可选：如果想换样式
         refreshBtn.classList.add('btn-primary'); // 可选：换成主要按钮样式
    }
    
    // **自动加载第一页数据**
    loadHistoryFromCloud(currentPage);

    // **** 新增：绑定检查本地按钮事件 ****
    const checkLocalBtn = document.getElementById('checkLocalBtn');
    if (checkLocalBtn) {
        checkLocalBtn.onclick = checkLocalRecords;
    }

    // 其他按钮的绑定 (导出等，保持不变或根据需要修改)
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    if (exportHistoryBtn) {
       // exportHistoryBtn.onclick = exportFullHistoryToExcel; // 需要实现 exportFullHistoryToExcel
    }
    // exportListBtn 的 onclick 在 HTML 中定义了

});

// 应用筛选条件并重新加载数据
function applyFiltersAndLoad() {
    currentFilters.startDate = document.getElementById('startDate').value;
    currentFilters.endDate = document.getElementById('endDate').value;
    currentFilters.position = document.getElementById('positionFilter').value;
    currentFilters.searchText = document.getElementById('searchInput').value.trim();
    loadHistoryFromCloud(1); // 筛选后总是从第一页开始加载
}

// 搜索记录（本质上也是应用筛选）
function searchRecords() {
    applyFiltersAndLoad();
}

// 排序表格
function sortTable(column) {
    if (currentSortColumn === column) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortOrder = 'desc'; // 默认首次点击降序
    }
    // 更新表头图标 (可选)
    updateSortIcons();
    // 重新加载当前页数据，应用新排序
    loadHistoryFromCloud(currentPage);
}

// 更新表头排序图标 (可选实现)
function updateSortIcons() {
    document.querySelectorAll('th[onclick^="sortTable"]').forEach(th => {
        const icon = th.querySelector('i.bi');
        if (!icon) return;
        const column = th.id.substring(3); // 获取列名，假设 th id 为 "th-columnName"
        icon.classList.remove('bi-arrow-down-up', 'bi-arrow-down', 'bi-arrow-up');
        if (column === currentSortColumn) {
            icon.classList.add(currentSortOrder === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down');
        } else {
            icon.classList.add('bi-arrow-down-up');
        }
    });
}

// **** 主要函数：从 LeanCloud 加载历史记录 ****
async function loadHistoryFromCloud(page = 1) {
    currentPage = page;
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '<tr><td colspan="10" class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 正在加载记录...</td></tr>'; // 显示加载提示

    try {
        // --- 构建基础查询 ---
        const query = new AV.Query('Assessment');
        query.include('userPointer'); // 包含用户信息

        // --- 应用筛选条件 ---
        // 日期筛选 (基于 endTime 字段)
        if (currentFilters.startDate) {
            query.greaterThanOrEqualTo('endTime', new Date(currentFilters.startDate + 'T00:00:00.000Z'));
        }
        if (currentFilters.endDate) {
            // 结束日期需要包含当天，所以设置到当天的 23:59:59.999
            const endDate = new Date(currentFilters.endDate + 'T00:00:00.000Z');
            endDate.setDate(endDate.getDate() + 1); // 加一天
            query.lessThan('endTime', endDate);
        }
        // 岗位筛选
        if (currentFilters.position) {
            query.equalTo('positionCode', currentFilters.position);
        }
        // 搜索筛选 (姓名或工号)
        if (currentFilters.searchText) {
            // 需要分别查询 UserProfile 和 Assessment
            const nameQuery = new AV.Query('UserProfile');
            nameQuery.contains('name', currentFilters.searchText); // 模糊匹配姓名

            const employeeIdQuery = new AV.Query('UserProfile');
             // 工号通常是精确匹配，如果需要模糊匹配，用 contains，但需要确保 employeeId 是字符串类型
             // 假设 employeeId 是数字类型，需要精确匹配
            const searchId = parseInt(currentFilters.searchText, 10);
             if (!isNaN(searchId)) {
                 employeeIdQuery.equalTo('employeeId', searchId); 
             } else {
                 // 如果输入的不是纯数字，可能只按姓名搜索，或返回空结果
                 // 这里我们合并查询，如果工号无效，该查询可能无结果
                 employeeIdQuery.equalTo('employeeId', -9999); // 使工号查询无结果
             }

            const userQuery = AV.Query.or(nameQuery, employeeIdQuery);
            // 查询匹配的用户
            const users = await userQuery.find();
            const userPointers = users.map(user => AV.Object.createWithoutData('UserProfile', user.id));
            
            if (userPointers.length > 0) {
                 // 如果找到用户，筛选 Assessment 中 userPointer 在这些用户中的记录
                 query.containedIn('userPointer', userPointers);
            } else {
                // 如果根据姓名/工号没找到用户，则主查询不可能有结果
                query.equalTo('objectId', '__NEVER_MATCH__'); // 设置一个不可能匹配的条件
            }
        }

        // --- 获取总数用于分页 ---
        totalRecords = await query.count();

        // --- 应用排序 ---
        if (currentSortOrder === 'asc') {
            if (currentSortColumn === 'rank') { /* 排名排序需要在前端处理 */ }
            else if (currentSortColumn === 'timestamp') query.addAscending('endTime');
            else if (currentSortColumn === 'totalScore') query.addAscending('totalScore');
            else if (currentSortColumn === 'scoreRate') query.addAscending('scoreRate');
            // 其他字段排序...
        } else {
            if (currentSortColumn === 'rank') { /* 排名排序需要在前端处理 */ }
            else if (currentSortColumn === 'timestamp') query.addDescending('endTime');
            else if (currentSortColumn === 'totalScore') query.addDescending('totalScore');
            else if (currentSortColumn === 'scoreRate') query.addDescending('scoreRate');
             // 其他字段排序...
        }
        // 默认添加一个次要排序，防止分页时顺序不稳定
        if (currentSortColumn !== 'endTime') {
            query.addDescending('endTime');
        }

        // --- 应用分页 ---
        query.limit(recordsPerPage);
        query.skip((page - 1) * recordsPerPage);

        // --- 执行查询 ---
        const results = await query.find();

        // --- 填充表格和分页 ---
        populateTable(results);
        setupPagination(totalRecords, page);

    } catch (error) {
        console.error("从云端加载历史记录失败:", error);
        tableBody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">加载失败: ${error.message}</td></tr>`;
        document.getElementById('pagination').innerHTML = ''; // 清空分页
    }
}

// **** 修改：填充表格数据 (使用云端对象) ****
function populateTable(records) {
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = ''; // 清空

    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">未找到符合条件的记录。</td></tr>';
        return;
    }

    // 如果需要按分数排名，可以在这里对 records 排序
    if (currentSortColumn === 'rank') {
        records.sort((a, b) => {
            const scoreA = a.get('totalScore') || 0;
            const scoreB = b.get('totalScore') || 0;
            // 降序排列
            return currentSortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        });
    }

    records.forEach((record, index) => {
        const rank = (currentPage - 1) * recordsPerPage + index + 1; // 计算序号/排名
        const assessmentTime = formatDate(record.get('endTime'), true);
        const userInfo = record.get('userPointer');
        const name = userInfo ? userInfo.get('name') : 'N/A';
        const employeeId = userInfo ? userInfo.get('employeeId') : 'N/A';
        const position = getPositionName(record.get('positionCode'));
        const totalScore = record.get('totalScore') !== undefined ? record.get('totalScore') : 'N/A';
        const scoreRate = record.get('scoreRate') !== undefined ? `${record.get('scoreRate')}%` : 'N/A';

        let durationText = 'N/A';
        const totalSeconds = record.get('totalActiveSeconds');
        if (totalSeconds !== undefined && totalSeconds !== null) {
           const minutes = Math.floor(totalSeconds / 60);
           const seconds = totalSeconds % 60;
           durationText = `${minutes}分`;
           if (seconds > 0) durationText += ` ${seconds}秒`;
        } else {
            const minutes = record.get('durationMinutes');
            if (minutes !== undefined && minutes !== null) durationText = `${minutes}分钟`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rank}</td>
            <td>${currentSortColumn === 'rank' ? rank : '-'}</td> <!-- 只有按排名排序时显示 -->
            <td>${assessmentTime}</td>
            <td>${name}</td>
            <td>${employeeId}</td>
            <td>${position}</td>
            <td>${durationText}</td>
            <td>${totalScore}</td>
            <td>${scoreRate}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary history-action-btn" onclick="viewDetail('${record.id}')">详情</button>
                <button class="btn btn-sm btn-outline-danger history-action-btn" onclick="deleteRecord('${record.id}', this)">删除</button>
                <!-- 可以添加"继续测评"按钮（如果状态是 paused） -->
                ${record.get('status') === 'paused' ? `<button class="btn btn-sm btn-outline-warning history-action-btn" onclick="resumeAssessment('${record.id}')">继续</button>` : ''}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// **** 修改：设置分页 (逻辑基本不变，但使用 totalRecords) ****
function setupPagination(totalItems, currentPage) {
    const paginationElement = document.getElementById('pagination');
    paginationElement.innerHTML = ''; // 清空
    const totalPages = Math.ceil(totalItems / recordsPerPage);

    if (totalPages <= 1) return; // 如果只有一页或没有数据，则不显示分页

    // 最多显示页码按钮数量
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 如果结束页码太小，调整开始页码
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 上一页按钮
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); loadHistoryFromCloud(${currentPage - 1})">&laquo;</a>`;
    paginationElement.appendChild(prevLi);

    // 第一页按钮 (如果需要)
    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        firstLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); loadHistoryFromCloud(1)">1</a>`;
        paginationElement.appendChild(firstLi);
        if (startPage > 2) {
             const ellipsisLi = document.createElement('li');
             ellipsisLi.className = 'page-item disabled';
             ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
             paginationElement.appendChild(ellipsisLi);
        }
    }

    // 中间页码按钮
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); loadHistoryFromCloud(${i})">${i}</a>`;
        paginationElement.appendChild(li);
    }

    // 最后一页按钮 (如果需要)
    if (endPage < totalPages) {
         if (endPage < totalPages - 1) {
             const ellipsisLi = document.createElement('li');
             ellipsisLi.className = 'page-item disabled';
             ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
             paginationElement.appendChild(ellipsisLi);
         }
        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        lastLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); loadHistoryFromCloud(${totalPages})">${totalPages}</a>`;
        paginationElement.appendChild(lastLi);
    }

    // 下一页按钮
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); loadHistoryFromCloud(${currentPage + 1})">&raquo;</a>`;
    paginationElement.appendChild(nextLi);
}

// **** 修改：查看详情 (从云端加载，或者如果已有数据则复用) ****
async function viewDetail(assessmentId) {
    const detailModalBody = document.getElementById('detailModalBody');
    detailModalBody.innerHTML = '<p class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 加载详情中...</p>';
    const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    detailModal.show();

    try {
        // 尝试从已加载的当前页数据中查找
        let assessment;
        if (currentCloudAssessment && currentCloudAssessment.id === assessmentId) {
             assessment = currentCloudAssessment; // 如果是当前结果页的记录
        } else {
            // 否则，需要重新查询
            const query = new AV.Query('Assessment');
            query.include('userPointer');
            assessment = await query.get(assessmentId);
        }

        // 查询关联的 AssessmentDetail
        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', assessment);
        detailQuery.limit(1000);
        const details = await detailQuery.find();

        // 构建详情 HTML
        let htmlContent = buildDetailHtml(assessment, details);
        detailModalBody.innerHTML = htmlContent;

    } catch (error) {
        console.error("加载详情失败:", error);
        detailModalBody.innerHTML = `<p class="text-danger text-center">加载详情失败: ${error.message}</p>`;
    }
}

// **** 新增：构建详情模态框内容的 HTML ****
function buildDetailHtml(assessment, details) {
    const userInfo = assessment.get('userPointer');
    const name = userInfo ? userInfo.get('name') : 'N/A';
    const employeeId = userInfo ? userInfo.get('employeeId') : 'N/A';
    const station = userInfo ? getStationName(userInfo.get('stationCode')) : 'N/A';
    const position = getPositionName(assessment.get('positionCode'));
    const assessor = assessment.get('assessorName') || 'N/A';
    const endTime = formatDate(assessment.get('endTime'), true);
    const totalScore = assessment.get('totalScore') !== undefined ? assessment.get('totalScore') : 'N/A';
    const maxScore = assessment.get('maxPossibleScore') !== undefined ? assessment.get('maxPossibleScore') : 'N/A';
    const scoreRate = assessment.get('scoreRate') !== undefined ? `${assessment.get('scoreRate')}%` : 'N/A';

    let durationText = 'N/A';
    // ... (时长计算逻辑同 populateTable) ...
     const totalSeconds = assessment.get('totalActiveSeconds');
     if (totalSeconds !== undefined && totalSeconds !== null) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        durationText = `${minutes}分`;
        if (seconds > 0) durationText += ` ${seconds}秒`;
     } else {
         const minutes = assessment.get('durationMinutes');
         if (minutes !== undefined && minutes !== null) durationText = `${minutes}分钟`;
     }

    let tableHtml = `
        <h6>基本信息</h6>
        <div class="row mb-3">
            <div class="col-md-6"><strong>姓名:</strong> ${name}</div>
            <div class="col-md-6"><strong>工号:</strong> ${employeeId}</div>
            <div class="col-md-6"><strong>车站:</strong> ${station}</div>
            <div class="col-md-6"><strong>岗位:</strong> ${position}</div>
            <div class="col-md-6"><strong>测评人:</strong> ${assessor}</div>
            <div class="col-md-6"><strong>测评时间:</strong> ${endTime}</div>
            <div class="col-md-6"><strong>测评用时:</strong> ${durationText}</div>
        </div>
        <h6>得分信息</h6>
        <div class="row mb-3">
            <div class="col-md-4"><strong>总分:</strong> ${totalScore}</div>
            <div class="col-md-4"><strong>标准分:</strong> ${maxScore}</div>
            <div class="col-md-4"><strong>得分率:</strong> ${scoreRate}</div>
        </div>
        <h6>题目详情</h6>
        <table class="table table-sm table-bordered mt-2">
          <thead>
            <tr><th>序号</th><th>题目内容</th><th>标准分</th><th>得分</th><th>用时(秒)</th><th>备注</th></tr>
          </thead>
          <tbody>
    `;

    if (details && details.length > 0) {
        details.forEach((detail, index) => {
            const qContent = detail.get('questionContent') || '';
            const stdScore = detail.get('standardScore') !== undefined ? detail.get('standardScore') : 'N/A';
            const score = detail.get('score') !== null && detail.get('score') !== undefined ? detail.get('score') : '未评分';
            const duration = detail.get('durationSeconds') !== undefined ? detail.get('durationSeconds') : 'N/A';
            const comment = detail.get('comment') || '无';
            tableHtml += `
                <tr>
                  <td>${index + 1}</td>
                  <td>${qContent}</td>
                  <td>${stdScore}</td>
                  <td>${score}</td>
                  <td>${duration}</td>
                  <td>${comment}</td>
                </tr>
            `;
        });
    } else {
        tableHtml += '<tr><td colspan="6" class="text-center text-muted">无题目详情数据</td></tr>';
    }

    tableHtml += `</tbody></table>`;
    return tableHtml;
}


// **** 修改：删除记录 (从云端删除) ****
async function deleteRecord(assessmentId, buttonElement) {
    if (!confirm(`确定要从云端永久删除这条记录 (ID: ${assessmentId}) 吗？此操作无法撤销。`)) {
        return;
    }

    try {
        const assessment = AV.Object.createWithoutData('Assessment', assessmentId);
        // 可选：先查询关联的 AssessmentDetail 并删除，或者设置级联删除规则
        // 这里简化处理，假设只删除 Assessment 记录
        await assessment.destroy({ useMasterKey: true }); // 使用 MasterKey 确保权限

        // 从表格中移除行 (视觉效果)
        const row = buttonElement.closest('tr');
        if (row) {
            row.remove();
        }
        alert('记录已从云端删除。');
        // 可能需要重新加载当前页或更新总数
        totalRecords--; // 简单更新总数
        setupPagination(totalRecords, currentPage);

    } catch (error) {
        console.error(`删除记录 (ID: ${assessmentId}) 失败:`, error);
        alert(`删除记录失败: ${error.message}`);
    }
}

// **** 导出列表功能 (需要修改以使用当前表格数据) ****
function exportHistoryList() {
    const table = document.querySelector('#historyTableBody');
    if (!table || table.rows.length === 0 || table.rows[0].cells.length === 1) { // Check if empty or showing "no records"
        alert('当前列表没有数据可导出。');
        return;
    }

    const data = [];
    // 添加表头
    const headers = [];
    document.querySelectorAll('#historyTableBody tr:first-child td').forEach((cell, index) => {
         // 获取对应的 th 内容作为表头，跳过最后一列"操作"
         const th = document.querySelector(`#historyTableBody thead th:nth-child(${index + 1})`);
         if (th && th.id !== 'th-actions') { // Skip actions column
             headers.push(th.textContent.replace(/ <i.*/, '').trim()); // Remove sort icon text
         }
    });
     data.push(headers);

    // 添加表格数据行
    for (let i = 0; i < table.rows.length; i++) {
        const row = table.rows[i];
        const rowData = [];
        // 只导出与表头对应的列，跳过最后一列"操作"
        for (let j = 0; j < headers.length; j++) { // Use headers.length to limit columns
            rowData.push(row.cells[j].textContent.trim());
        }
        data.push(rowData);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '历史记录列表');

    try {
        XLSX.writeFile(workbook, `测评历史记录列表_${formatDate(new Date(), true)}.xlsx`);
    } catch (error) {
        console.error("导出列表失败:", error);
        alert("导出列表失败，请检查浏览器权限或联系管理员。");
    }
}

// **** 导出历史记录 (Excel) 功能 (需要修改为查询云端所有数据) ****
async function exportFullHistoryToExcel() {
    alert("正在准备导出所有历史记录，数据量大时可能需要一些时间...");
    // 这个函数需要重新实现：
    // 1. 构建一个查询，获取所有符合筛选条件的 Assessment 记录（可能需要分批获取）
    // 2. 对每条 Assessment 记录，查询其关联的 AssessmentDetail 记录
    // 3. 将所有数据整理成适合 Excel 的格式（可能包含多个 Sheet）
    // 4. 使用 XLSX 库生成并下载 Excel 文件
    console.warn("导出完整历史记录功能尚未完全实现云端查询逻辑。");
    // 临时方案：只导出当前页数据（如果需要）
    // exportHistoryList();
}
// 绑定导出按钮事件 (如果按钮存在)
const exportFullBtn = document.getElementById('exportHistoryBtn');
if (exportFullBtn) {
    exportFullBtn.onclick = exportFullHistoryToExcel;
}

// **** 继续测评功能 ****
function resumeAssessment(assessmentId) {
     // 这个功能需要重新设计
     // 原来的逻辑是从 localStorage 加载暂停的数据
     // 现在需要从云端获取数据，并在 assessment.html 页面加载时恢复状态
     // 简单实现：跳转到 assessment.html，让它自己处理恢复逻辑（需要 assessment.js 支持）
     console.warn("继续测评功能需要调整以适配云端数据。");
     // 示例跳转：
     // window.location.href = `assessment.html?resumeId=${assessmentId}`;
     alert("继续测评功能待完善。");
}

// **** 导出详情功能 (需要修改为使用云端数据) ****
function exportDetail() {
     if (!currentCloudAssessment || !currentCloudDetails) {
         alert("没有可导出的详情数据。");
         return;
     }
     // 这个函数需要重新实现：
     // 1. 使用 currentCloudAssessment 和 currentCloudDetails 中的数据
     // 2. 将数据整理成适合 Excel 的格式
     // 3. 使用 XLSX 库生成并下载 Excel 文件
     console.warn("导出详情功能尚未完全实现云端数据导出逻辑。");
     alert("导出详情功能待完善。");
}

// **** 新增：检查本地暂存/失败的记录 ****
function checkLocalRecords() {
    console.log("[checkLocalRecords] 开始检查本地记录...");
    const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    localUnsyncedRecords = history.filter(record => 
        record.status === 'paused' || record.status === 'failed_to_submit'
    );
    console.log(`[checkLocalRecords] 找到 ${localUnsyncedRecords.length} 条未同步记录。`);

    // 获取用于显示结果的容器 (可以是一个独立的 div，或者在表格上方插入)
    let localRecordsContainer = document.getElementById('localRecordsDisplayArea');
    if (!localRecordsContainer) {
        localRecordsContainer = document.createElement('div');
        localRecordsContainer.id = 'localRecordsDisplayArea';
        localRecordsContainer.className = 'mt-4 mb-3 p-3 border rounded bg-light shadow-sm';
        // 插入到筛选区域下方，表格上方
        const filterSection = document.querySelector('.filter-section');
        const tableContainer = document.querySelector('.table-responsive');
        if (filterSection && tableContainer) {
             filterSection.insertBefore(localRecordsContainer, tableContainer);
        } else {
            // Fallback: 插入到 container 顶部
            document.querySelector('.container').insertBefore(localRecordsContainer, document.querySelector('.container').firstChild);
        }
    }

    // 清空之前的内容
    localRecordsContainer.innerHTML = '';

    if (localUnsyncedRecords.length === 0) {
        localRecordsContainer.innerHTML = '<p class="text-center text-muted mb-0"><i class="bi bi-check-circle me-1"></i> 没有找到本地暂存或提交失败的测评记录。</p>';
    } else {
        let listHtml = '<h6 class="mb-3"><i class="bi bi-hdd-stack me-2"></i>本地暂存/失败记录</h6><ul class="list-group">'
        localUnsyncedRecords.forEach((record, index) => {
            const timestamp = formatDate(record.timestamp || record.startTime, true); // 使用友好的时间格式
            const name = record.userInfo?.name || '未知';
            const position = getPositionName(record.position || record.userInfo?.position);
            let statusBadge = '';
            let actionsHtml = '';

            if (record.status === 'paused') {
                statusBadge = '<span class="badge bg-warning text-dark ms-2">暂存中</span>';
                actionsHtml = `
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="resumeLocalAssessment('${record.id}')"><i class="bi bi-play-circle"></i> 继续</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteLocalRecord('${record.id}')"><i class="bi bi-trash"></i> 删除本地</button>
                `;
            } else if (record.status === 'failed_to_submit') {
                statusBadge = '<span class="badge bg-danger ms-2">提交失败</span>';
                actionsHtml = `
                    <button class="btn btn-sm btn-outline-success me-1" onclick="retrySubmit('${record.id}', this)"><i class="bi bi-cloud-upload"></i> 重试提交</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteLocalRecord('${record.id}')"><i class="bi bi-trash"></i> 删除本地</button>
                `;
            }

            listHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center" data-record-id="${record.id}">
                    <div>
                        <strong>${name}</strong> (${position}) ${statusBadge}<br>
                        <small class="text-muted">时间: ${timestamp}</small>
                    </div>
                    <div>
                        ${actionsHtml}
                    </div>
                </li>
            `;
        });
        listHtml += '</ul>';
        localRecordsContainer.innerHTML = listHtml;
    }
}

// **** 新增：删除本地记录 ****
function deleteLocalRecord(recordIdToDelete) {
     if (!confirm('确定要删除这条本地记录吗？此操作不可恢复。')) return;

     console.log(`[deleteLocalRecord] Deleting local record with ID: ${recordIdToDelete}`);
     let history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
     const initialLength = history.length;
     history = history.filter(record => record.id != recordIdToDelete); // 使用非严格比较以防类型问题

     if (history.length < initialLength) {
         localStorage.setItem('assessmentHistory', JSON.stringify(history));
         console.log("[deleteLocalRecord] Local record deleted.");
         // 从显示的列表中移除
         const listItem = document.querySelector(`#localRecordsDisplayArea li[data-record-id="${recordIdToDelete}"]`);
         if (listItem) {
             listItem.remove();
         }
         // 检查是否列表已空
         if (document.querySelectorAll('#localRecordsDisplayArea li').length === 0) {
             checkLocalRecords(); // 重新调用以显示"无记录"消息
         }
     } else {
         console.warn("[deleteLocalRecord] Could not find local record to delete with ID:", recordIdToDelete);
         alert("删除失败，未找到对应的本地记录。");
     }
}

// **** 新增：继续本地暂存的测评 ****
function resumeLocalAssessment(recordIdToResume) {
    console.log(`[resumeLocalAssessment] Resuming assessment with local ID: ${recordIdToResume}`);
    let history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    const assessmentToResume = history.find(record => record.id == recordIdToResume && record.status === 'paused');

    if (assessmentToResume) {
        // 检查是否有正在进行的测评
        if (localStorage.getItem('currentAssessment')) {
            const currentData = JSON.parse(localStorage.getItem('currentAssessment'));
            // 如果当前的就是要恢复的，或者当前的是已提交/失败的，可以直接覆盖
            if (currentData.id == recordIdToResume || currentData.status === 'completed' || currentData.status === 'failed_to_submit') {
                 // 可以直接覆盖
            } else if (!confirm("当前已有正在进行的测评。继续将覆盖当前进度，确定要继续吗？")) {
                 return; // 用户取消
            }
        }

        // 将选中的测评记录存入 currentAssessment
        localStorage.setItem('currentAssessment', JSON.stringify(assessmentToResume));

        // 从历史记录中移除暂存状态（推荐）
        history = history.filter(record => record.id != recordIdToResume);
        localStorage.setItem('assessmentHistory', JSON.stringify(history));

        console.log("Assessment data loaded into currentAssessment. Redirecting...");
        window.location.href = 'assessment.html'; // 跳转到测评页面
    } else {
        console.error(`无法找到 ID 为 ${recordIdToResume} 的可继续的本地测评记录。`);
        alert("无法继续测评，记录可能已被删除或状态已改变。");
        checkLocalRecords(); // 刷新本地列表显示
    }
}

// **** 新增：重试提交失败的记录 ****
async function retrySubmit(recordIdToRetry, buttonElement) {
    console.log(`[retrySubmit] Retrying submission for local ID: ${recordIdToRetry}`);
    let history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    const recordToRetry = history.find(record => record.id == recordIdToRetry && record.status === 'failed_to_submit');

    if (!recordToRetry) {
        alert("无法重试提交，未找到对应的本地失败记录。");
        checkLocalRecords(); // 刷新列表
        return;
    }

    // 禁用按钮
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 提交中...';
    }

    // 准备数据 (与 assessment.js 类似，但使用 recordToRetry)
    // 需要确保 recordToRetry 包含所有需要提交的数据
    const assessmentData = { ...recordToRetry }; // 创建副本以防修改原始记录
    // 可以在这里重新设置 assessorName 或其他需要确认的信息
    assessmentData.status = 'completed'; // 假设重试成功后是完成状态
    assessmentData.timestamp = new Date().toISOString(); // 更新时间戳为当前时间
    // 移除本地特定的错误信息字段 (如果存在)
    delete assessmentData.errorInfo;

    console.log("[retrySubmit] 准备调用云函数 submitAssessmentCloud...");
    console.log("[retrySubmit] 传递的数据包预览:", JSON.parse(JSON.stringify(assessmentData)));

    try {
        const savedAssessmentObjectId = await AV.Cloud.run('submitAssessmentCloud', { assessmentData: assessmentData });
        console.log("[retrySubmit] 云函数调用成功，返回 Assessment ObjectId:", savedAssessmentObjectId);

        // 提交成功，从本地历史记录中移除
        history = history.filter(record => record.id != recordIdToRetry);
        localStorage.setItem('assessmentHistory', JSON.stringify(history));
        console.log("[retrySubmit] 已从本地历史记录中移除成功提交的记录。");

        alert(`记录 (本地ID: ${recordIdToRetry}) 成功提交到云端！`);
        checkLocalRecords(); // 刷新本地列表
        loadHistoryFromCloud(1); // 刷新云端列表

    } catch (error) {
        console.error(`[retrySubmit] 重试提交记录 ID ${recordIdToRetry} 时出错:`, error);
        alert(`重新提交失败: ${error.message || '未知错误'}`);
        // 恢复按钮状态
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="bi bi-cloud-upload"></i> 重试提交';
        }
    }
}

// **** Helper Functions (保持或从 result.js 复制) ****
function getStationName(stationCode) {
     const stationMap = { 'grand_hall': '大礼堂', 'seven_hills': '七星岗', 'houbao': '后堡', 'wanshou': '万寿路', 'nanhu': '南湖', 'lanhua': '兰花路' };
     return stationMap[stationCode] || stationCode || '未知';
 }
function getPositionName(positionCode) {
     const positionMap = { 'duty_station': '值班站长', 'station_duty': '车站值班员', 'station_safety': '站务安全员' };
     if (['值班站长', '车站值班员', '站务安全员'].includes(positionCode)) return positionCode;
     return positionMap[positionCode] || positionCode || '未知';
 }
function formatDate(dateObject, includeTime = false) {
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
     } catch (e) { console.error("日期格式化错误:", e); return '日期错误'; }
 }