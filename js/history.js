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
    
    // **** 新增：绑定检查本地按钮事件 **** (保持绑定，但下面会自动调用一次)
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

    // **自动加载第一页云端数据**
    loadHistoryFromCloud(currentPage); // Start loading cloud data

    // **** 修改：移除页面加载时自动检查本地记录 ****
    // checkLocalRecords(); // Automatically check local records on load

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

// **** 新增：辅助函数 - 延迟 ****
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// **** 主要函数：从 LeanCloud 加载历史记录 ****
async function loadHistoryFromCloud(page = 1) {
    currentPage = page;
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '<tr><td colspan="10" class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 正在加载记录...</td></tr>';

    try {
        // --- 构建基础查询 (用于分页显示) ---
        const displayQuery = await buildAssessmentQuery(); // Now async due to user search

        // --- 获取总数用于分页 ---
        totalRecords = await displayQuery.count();

        // --- 应用排序 (用于分页显示) ---
        applySortingToQuery(displayQuery);

        // --- 应用分页 (用于分页显示) ---
        displayQuery.limit(recordsPerPage); // UI table uses 10 per page
        displayQuery.skip((page - 1) * recordsPerPage);

        // --- 执行查询 (用于分页显示) ---
        const results = await displayQuery.find();

        // --- 填充表格和分页 ---
        populateTable(results); // Update UI table
        setupPagination(totalRecords, page);

        // --- [修改] 后台分批同步所有符合条件的记录到本地存储 ---
        console.log("开始后台同步所有符合条件的记录到本地存储...");
        syncAllFilteredCloudDataToLocal(); // Call the updated sync function

    } catch (error) {
        console.error("从云端加载历史记录失败:", error);
        tableBody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">加载失败: ${error.message}</td></tr>`;
        document.getElementById('pagination').innerHTML = '';
    }
}

// **** 修改：构建基础 Assessment 查询 (改为 async) ****
async function buildAssessmentQuery() {
    const query = new AV.Query('Assessment');
    query.include('userPointer');

    // --- 应用筛选条件 ---
    if (currentFilters.startDate) {
        query.greaterThanOrEqualTo('startTime', new Date(currentFilters.startDate + 'T00:00:00.000Z'));
    }
    if (currentFilters.endDate) {
        const endDate = new Date(currentFilters.endDate + 'T00:00:00.000Z');
        endDate.setDate(endDate.getDate() + 1);
        query.lessThan('startTime', endDate);
    }
    if (currentFilters.position) {
        query.equalTo('positionCode', currentFilters.position);
    }

    // --- 处理用户搜索 (异步) ---
    if (currentFilters.searchText) {
        try {
            const nameQuery = new AV.Query('UserProfile');
            nameQuery.contains('name', currentFilters.searchText);
            const employeeIdQuery = new AV.Query('UserProfile');
            const searchId = parseInt(currentFilters.searchText, 10);
            if (!isNaN(searchId)) {
                employeeIdQuery.equalTo('employeeId', searchId);
            } else {
                 employeeIdQuery.equalTo('employeeId', -9999); // 使工号查询无结果
            }
            const userQuery = AV.Query.or(nameQuery, employeeIdQuery);
            userQuery.select('objectId'); // 只需要用户的 objectId
            const users = await userQuery.find();

            if (users.length > 0) {
                 query.containedIn('userPointer', users); // users 是包含指针的对象数组
            } else {
                  query.equalTo('objectId', '__NEVER_MATCH__'); // 没有匹配的用户
            }
        } catch (error) {
             console.error("搜索用户失败:", error);
             query.equalTo('objectId', '__NEVER_MATCH__'); // 出错时使查询无结果
        }
    }
    return query;
}

// **** 新增：应用排序到查询对象 (无修改) ****
function applySortingToQuery(query) {
    const sortMap = {
        timestamp: 'startTime',
        totalScore: 'totalScore',
        scoreRate: 'scoreRate',
    };
    const sortField = sortMap[currentSortColumn];

    if (sortField) {
        if (currentSortOrder === 'asc') {
            query.addAscending(sortField);
        } else {
            query.addDescending(sortField);
        }
    } else if (currentSortColumn !== 'rank') {
         query.addDescending('startTime');
    }
    if (currentSortColumn !== 'timestamp') {
         query.addDescending('startTime');
    }
}

// **** 修改：后台同步云端数据到本地 (增加失败回退和慢速模式) ****
async function syncAllFilteredCloudDataToLocal() {
    // 定义模式参数
    const FAST_MODE = { batchSize: 50, delay: 0 };
    const SLOW_MODE = { batchSize: 20, delay: 500 }; // 慢速模式：小批次，500ms延迟

    // 内部核心同步函数
    async function performSync(mode, isRetry = false) {
        const { batchSize, delay } = mode;
        let allAssessmentRecords = [];
        let allDetails = []; // 移到这里，避免重试时重复获取
        let skip = 0;
        let fetchedInLastBatch = 0;
        console.log(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] Starting sync. Batch size: ${batchSize}, Delay: ${delay}ms`);

        try {
            // 1. 分批获取 Assessment 数据
            do {
                const batchQuery = await buildAssessmentQuery();
                applySortingToQuery(batchQuery);
                batchQuery.limit(batchSize);
                batchQuery.skip(skip);
                batchQuery.include('userPointer');

                const batchResults = await batchQuery.find();
                fetchedInLastBatch = batchResults.length;
                allAssessmentRecords = allAssessmentRecords.concat(batchResults);
                skip += fetchedInLastBatch;
                console.log(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] Fetched batch: ${fetchedInLastBatch} records. Total fetched: ${allAssessmentRecords.length}`);

                // 如果是慢速模式，添加延迟
                if (delay > 0) {
                    await sleep(delay);
                }

            } while (fetchedInLastBatch === batchSize);

            console.log(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] Finished fetching Assessments. Total: ${allAssessmentRecords.length}. Now fetching details...`);

            if (allAssessmentRecords.length === 0) {
                localStorage.setItem('assessmentHistory', JSON.stringify([]));
                console.log(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] No matching records found in cloud. Local assessmentHistory cleared.`);
                return true; // 同步成功（虽然是空的）
            }

            // 2. 获取所有关联的 AssessmentDetail
            // 注意：获取 Detail 仍然可能因数量过多触发流控，但 LeanCloud SDK 的 find 通常内部有处理
            // 如果 fetch Details 仍然频繁失败，可能需要将 Details 的获取也分批并加入延迟
            if (allAssessmentRecords.length > 0) {
                const assessmentPointers = allAssessmentRecords.map(record => AV.Object.createWithoutData('Assessment', record.id));
                const detailQuery = new AV.Query('AssessmentDetail');
                detailQuery.containedIn('assessmentPointer', assessmentPointers);
                detailQuery.include('assessmentPointer'); // 可选，取决于是否需要
                detailQuery.limit(1000); // 单次查询 Detail 上限
                // 如果 Assessment 数量远超 100，这里可能需要分批查询 Detail
                allDetails = await detailQuery.find(); 
            }

            const detailsByAssessmentId = allDetails.reduce((acc, detail) => {
                 const assessmentId = detail.get('assessmentPointer')?.id;
                 if (assessmentId) {
                     if (!acc[assessmentId]) acc[assessmentId] = [];
                     acc[assessmentId].push(detail);
                 }
                 return acc;
             }, {});
            console.log(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] Fetched ${allDetails.length} related AssessmentDetail records.`);

            // 3. 格式化数据并存入 localStorage (逻辑不变)
            const formattedHistory = [];
             for (const record of allAssessmentRecords) {
                 const userInfo = record.get('userPointer');
                 const details = detailsByAssessmentId[record.id] || [];

                 const localRecord = {
                     id: record.id,
                     userInfo: userInfo ? {
                         name: userInfo.get('name'),
                         employeeId: userInfo.get('employeeId'),
                         station: userInfo.get('stationCode'),
                         position: record.get('positionCode'),
                         positionName: getPositionName(record.get('positionCode')),
                     } : {},
                     position: record.get('positionCode'),
                     assessor: record.get('assessorName'),
                     timestamp: record.get('endTime')?.toISOString(),
                     startTime: record.get('startTime')?.toISOString(),
                     duration: record.get('durationMinutes'),
                     score: {
                         totalScore: record.get('totalScore'),
                         maxScore: record.get('maxPossibleScore'),
                         scoreRate: record.get('scoreRate'),
                     },
                      questions: details.map(d => ({
                          id: d.get('questionId'),
                          content: d.get('questionContent'),
                          standardScore: d.get('standardScore'),
                          standardAnswer: d.get('standardAnswer'),
                          section: d.get('section'),
                          type: d.get('type'),
                          knowledgeSource: d.get('knowledgeSource')
                      })),
                     answers: details.reduce((acc, d) => {
                         const qId = d.get('questionId');
                         acc[qId] = {
                             score: d.get('score'),
                             comment: d.get('comment'),
                             startTime: null,
                             duration: d.get('durationSeconds'),
                         };
                         return acc;
                     }, {}),
                     status: record.get('status'),
                     elapsedSeconds: record.get('elapsedSeconds'),
                     currentQuestionIndex: record.get('currentQuestionIndex'),
                     totalActiveSeconds: record.get('totalActiveSeconds'),
                 };
                  formattedHistory.push(localRecord);
             }
            localStorage.setItem('assessmentHistory', JSON.stringify(formattedHistory));
            console.log(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] Sync complete. ${formattedHistory.length} records saved to local assessmentHistory.`);
            return true; // 同步成功

        } catch (error) {
            console.error(`[syncLocal:${isRetry ? 'SLOW' : 'FAST'}] Sync failed:`, error);
            // 将错误向上抛出，由主函数处理
            throw error;
        }
    }

    // ---- 主逻辑：尝试快速同步，失败则回退到慢速 ----
    try {
        await performSync(FAST_MODE, false); // 尝试快速模式
        console.log("[syncLocal] Fast sync attempt finished.");
    } catch (error) {
        console.warn("[syncLocal] Fast sync failed.", error);
        // 检查是否是流控错误 (LeanCloud API Rate Limit 通常是 code 155)
        if (error && (error.code === 155 || error.code === 429)) { 
            console.warn("[syncLocal] Rate limit error detected. Falling back to SLOW sync mode...");
            try {
                await performSync(SLOW_MODE, true); // 尝试慢速模式
                console.log("[syncLocal] Slow sync attempt finished.");
            } catch (slowError) {
                console.error("[syncLocal] Slow sync also failed:", slowError);
                // 可以选择在这里通知用户同步失败
                // alert("同步云端历史记录失败，请稍后重试或联系管理员。");
            }
        } else {
            // 其他类型的错误
            console.error("[syncLocal] Sync failed due to non-rate-limit error:", error);
            // alert("同步云端历史记录时发生错误。");
        }
    }
}

// **** 修改：填充表格数据 (显示 startTime, 处理 paused/failed 状态) ****
function populateTable(records) {
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '';

    if (!records || records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">未找到符合条件的记录。</td></tr>';
        return;
    }

    // 前端排名逻辑 (如果按 rank 排序)
    if (currentSortColumn === 'rank') {
        records.sort((a, b) => {
            const scoreA = a.get('totalScore') || 0;
            const scoreB = b.get('totalScore') || 0;
            return currentSortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        });
    }

    records.forEach((record, index) => {
        const rank = (currentPage - 1) * recordsPerPage + index + 1;
        const assessmentStartTime = formatDate(record.get('startTime'), true); // 使用 startTime
        const userInfo = record.get('userPointer');
        const name = userInfo ? userInfo.get('name') : 'N/A';
        const employeeId = userInfo ? userInfo.get('employeeId') : 'N/A';
        const position = getPositionName(record.get('positionCode'));
        const recordStatus = record.get('status'); // 获取状态
        const isPaused = recordStatus === 'paused';
        const isFailed = recordStatus === 'failed_to_submit';

        // 如果是 paused 或 failed，分数显示 --
        const totalScore = (isPaused || isFailed) ? '--' : (record.get('totalScore') !== undefined ? record.get('totalScore') : 'N/A');
        const scoreRate = (isPaused || isFailed) ? '--' : (record.get('scoreRate') !== undefined ? `${record.get('scoreRate')}%` : 'N/A');

        let durationText = 'N/A';
        const totalSeconds = record.get('totalActiveSeconds');
        if (totalSeconds !== undefined && totalSeconds !== null) {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            durationText = `${minutes}分`;
            if (seconds > 0) durationText += ` ${seconds}秒`;
        } else {
            // Fallback to durationMinutes if active seconds not available
            const minutes = record.get('durationMinutes');
            if (minutes !== undefined && minutes !== null) durationText = `${minutes}分钟`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rank}</td>
            <td>${currentSortColumn === 'rank' ? rank : '-'}</td>
            <td>${assessmentStartTime}</td>
            <td>${name}</td>
            <td>${employeeId}</td>
            <td>${position}</td>
            <td>${durationText}</td>
            <td>${totalScore}</td>
            <td>${scoreRate}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary history-action-btn" onclick="viewDetail('${record.id}')">详情</button>
                <button class="btn btn-sm btn-outline-danger history-action-btn" onclick="deleteRecord('${record.id}', this)">删除</button>
                ${isPaused ? `<button class="btn btn-sm btn-outline-warning history-action-btn" onclick="resumeAssessment('${record.id}')">继续</button>` : ''}
                ${isFailed ? `<button class="btn btn-sm btn-outline-success history-action-btn" onclick="retrySubmit('${record.id}', this)">重试提交</button>` : ''}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// **** 设置分页 ****
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

// **** 修改：查看详情 (处理云端数据) ****
async function viewDetail(assessmentId) {
    const detailModalBody = document.getElementById('detailModalBody');
    detailModalBody.innerHTML = '<p class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 加载详情中...</p>';
    // Ensure modal exists before trying to show
    const detailModalElement = document.getElementById('detailModal');
    if (!detailModalElement) {
        console.error("Detail modal element not found!");
        detailModalBody.innerHTML = '<p class="text-danger text-center">错误：详情模态框未找到。</p>';
            return;
        }
    const detailModal = new bootstrap.Modal(detailModalElement);
    detailModal.show();

    try {
        // 直接从云端查询，不依赖 currentCloudAssessment 或内存中的数据
        const query = new AV.Query('Assessment');
        query.include('userPointer');
        const assessment = await query.get(assessmentId);

        // 查询关联的 AssessmentDetail
        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', assessment);
        detailQuery.limit(1000); // Assume max 1000 questions per assessment
        const details = await detailQuery.find();

        // 构建详情 HTML
        let htmlContent = buildDetailHtml(assessment, details);
        detailModalBody.innerHTML = htmlContent;

    } catch (error) {
        console.error("加载详情失败:", error);
        detailModalBody.innerHTML = `<p class="text-danger text-center">加载详情失败: ${error.message || '未知错误'}</p>`;
    }
}

// **** 新增：构建详情模态框内容的 HTML (增加本地题库补充答案) ****
function buildDetailHtml(assessment, details) {
    // **** 新增：加载本地题库 ****
    let questionBank = [];
    try {
        questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
    } catch (e) {
        console.error("Error loading question bank from localStorage:", e);
    }
    // **** 结束加载 ****

    const userInfo = assessment.get('userPointer');
    const name = userInfo ? userInfo.get('name') : 'N/A';
    const employeeId = userInfo ? userInfo.get('employeeId') : 'N/A';
    const station = userInfo ? getStationName(userInfo.get('stationCode')) : 'N/A';
    const position = getPositionName(assessment.get('positionCode'));
    const assessor = assessment.get('assessorName') || 'N/A';
    const endTime = formatDate(assessment.get('endTime'), true);
    const startTime = formatDate(assessment.get('startTime'), true);
    const totalScore = assessment.get('totalScore') !== undefined ? assessment.get('totalScore') : 'N/A';
    const maxScore = assessment.get('maxPossibleScore') !== undefined ? assessment.get('maxPossibleScore') : 'N/A';
    const scoreRate = assessment.get('scoreRate') !== undefined ? `${assessment.get('scoreRate')}%` : 'N/A';
    // **** Translate Status ****
    const statusRaw = assessment.get('status') || 'unknown';
    let statusText = statusRaw;
    let statusBadgeClass = 'bg-secondary';
    switch (statusRaw) {
        case 'completed':
            statusText = '已完成';
            statusBadgeClass = 'bg-success';
            break;
        case 'paused':
            statusText = '已暂停';
            statusBadgeClass = 'bg-warning text-dark'; // Dark text for better contrast on yellow
            break;
        case 'failed_to_submit':
            statusText = '提交失败';
            statusBadgeClass = 'bg-danger';
            break;
        case 'in_progress':
            statusText = '进行中';
            statusBadgeClass = 'bg-info text-dark'; // Dark text for better contrast on light blue
            break;
        default:
            statusText = '未知';
            statusBadgeClass = 'bg-secondary';
    }

    let durationText = 'N/A';
     const totalSeconds = assessment.get('totalActiveSeconds');
     if (totalSeconds !== undefined && totalSeconds !== null) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        durationText = `${minutes}分 ${seconds}秒`;
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
            <div class="col-md-6"><strong>开始时间:</strong> ${startTime}</div>
            <div class="col-md-6"><strong>完成时间:</strong> ${endTime}</div>
            <div class="col-md-6"><strong>测评用时:</strong> ${durationText}</div>
            <div class="col-md-6"><strong>状态:</strong> <span class="badge ${statusBadgeClass}">${statusText}</span></div>
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
        // Sort details based on their order if available, otherwise keep fetched order
        details.sort((a, b) => (a.get('questionOrder') || 0) - (b.get('questionOrder') || 0));

        details.forEach((detail, index) => {
            const qContent = detail.get('questionContent') || '';
            // Ensure score is a number before formatting
             const scoreRaw = detail.get('score');
             const score = (scoreRaw !== null && scoreRaw !== undefined && !isNaN(scoreRaw)) ? Number(scoreRaw) : '未评分';
             const stdScore = detail.get('standardScore') !== undefined ? detail.get('standardScore') : 'N/A';
             const duration = detail.get('durationSeconds') !== undefined ? detail.get('durationSeconds') : 'N/A';
            const comment = detail.get('comment') || '无';

            // **** 修改：从本地题库获取标准答案 ****
            const questionId = detail.get('questionId');
            let standardAnswer = '未找到题库记录'; // 默认值
            const bankQuestion = questionBank.find(q => q.id == questionId); // 使用非严格比较
            if (bankQuestion && bankQuestion.standardAnswer) {
                standardAnswer = bankQuestion.standardAnswer;
            }
            // **** 结束获取 ****

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

    // Disable button to prevent double clicks
    if (buttonElement) buttonElement.disabled = true;

    try {
        // First, query and delete related AssessmentDetail records
        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', AV.Object.createWithoutData('Assessment', assessmentId));
        detailQuery.limit(1000); // Set a limit
        const detailsToDelete = await detailQuery.find();

        if (detailsToDelete.length > 0) {
            console.log(`Deleting ${detailsToDelete.length} related AssessmentDetail records...`);
             // Use destroyAll for efficiency if possible, otherwise loop
             // Note: destroyAll might have limits, loop is safer for large numbers
             for (const detail of detailsToDelete) {
                 await detail.destroy({ useMasterKey: true }); // Use MasterKey if needed
             }
            // await AV.Object.destroyAll(detailsToDelete, { useMasterKey: true });
            console.log("Related AssessmentDetail records deleted.");
        }

        // Then, delete the main Assessment record
        const assessment = AV.Object.createWithoutData('Assessment', assessmentId);
        await assessment.destroy({ useMasterKey: true }); // Use MasterKey if needed

        alert('记录及其详情已从云端删除。');

        // Refresh the current page data
        loadHistoryFromCloud(currentPage); // Reload to reflect deletion and update pagination

        // Also, update the local storage sync in the background
        syncAllFilteredCloudDataToLocal();

    } catch (error) {
        console.error(`删除记录 (ID: ${assessmentId}) 失败:`, error);
        alert(`删除记录失败: ${error.message}`);
        // Re-enable button if deletion failed
        if (buttonElement) buttonElement.disabled = false;
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
    alert("正在准备导出所有符合当前筛选条件的记录，数据量大时可能需要一些时间...");
    const exportButton = document.getElementById('exportHistoryBtn');
    if(exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 导出中...';
    }

    try {
        const maxExportLimit = 500; // Set a practical limit for full export
        const allRecords = [];
        const allRecordDetails = {}; // Store details by assessment ID
        let skip = 0;
        const batchSize = 50; // Use a reasonable batch size for fetching

        // Fetch all Assessment records matching filters (up to limit)
        while (allRecords.length < maxExportLimit) {
            const query = await buildAssessmentQuery();
            applySortingToQuery(query); // Apply current sorting
            query.limit(batchSize);
            query.skip(skip);
            query.include('userPointer');
            const batchResults = await query.find();

            if (batchResults.length === 0) {
                break; // No more records
            }
            allRecords.push(...batchResults);
            skip += batchResults.length;

            if (batchResults.length < batchSize) {
                break; // Last batch was not full
            }
        }

        if (allRecords.length === 0) {
             alert("没有找到符合当前筛选条件的记录可导出。");
             return;
        }
        if (allRecords.length >= maxExportLimit) {
             alert(`导出记录数已达上限 (${maxExportLimit})。如果需要导出更多记录，请调整筛选条件。`);
        }

        console.log(`Exporting ${allRecords.length} assessment records.`);

        // Fetch all related AssessmentDetails (might need batching for large datasets)
        const assessmentPointers = allRecords.map(r => AV.Object.createWithoutData('Assessment', r.id));
        // Batch detail fetching if many assessments
        const detailBatchSize = 100; // How many assessments' details to fetch per query
        for (let i = 0; i < assessmentPointers.length; i += detailBatchSize) {
            const batchPointers = assessmentPointers.slice(i, i + detailBatchSize);
            if (batchPointers.length > 0) {
                 const detailQuery = new AV.Query('AssessmentDetail');
                 detailQuery.containedIn('assessmentPointer', batchPointers);
                 detailQuery.include('assessmentPointer');
                 detailQuery.limit(1000); // Max details per batch of assessments
                 const batchDetails = await detailQuery.find();
                 batchDetails.forEach(detail => {
                    const assessmentId = detail.get('assessmentPointer')?.id;
                    if (assessmentId) {
                        if (!allRecordDetails[assessmentId]) allRecordDetails[assessmentId] = [];
                         allRecordDetails[assessmentId].push(detail);
                    }
                 });
                 console.log(`Fetched details for assessments ${i} to ${Math.min(i + detailBatchSize, assessmentPointers.length)}...`);
            }
        }


        // Prepare data for Excel sheets
        const summaryData = [
             ['序号', '开始时间', '姓名', '工号', '岗位', '测评用时', '总分', '得分率', '状态', '测评人', '云端ID'] // Headers
        ];
        const detailSheetsData = {}; // { assessmentId: [ [headers], [row1], [row2]... ] }

        allRecords.forEach((record, index) => {
            const userInfo = record.get('userPointer');
            const name = userInfo ? userInfo.get('name') : 'N/A';
            const employeeId = userInfo ? userInfo.get('employeeId') : 'N/A';
            const position = getPositionName(record.get('positionCode'));
            const startTime = formatDate(record.get('startTime'), true);
            const totalScore = record.get('totalScore') ?? 'N/A';
            const scoreRate = record.get('scoreRate') !== undefined ? `${record.get('scoreRate')}%` : 'N/A';
            const status = record.get('status') || 'N/A';
            const assessor = record.get('assessorName') || 'N/A';
            const recordId = record.id;

             let durationText = 'N/A';
             const totalSeconds = record.get('totalActiveSeconds');
             if (totalSeconds !== undefined && totalSeconds !== null) {
                 const minutes = Math.floor(totalSeconds / 60);
                 const seconds = totalSeconds % 60;
                 durationText = `${minutes}分 ${seconds}秒`;
             } else {
                  const minutes = record.get('durationMinutes');
                  if (minutes !== undefined && minutes !== null) durationText = `${minutes}分钟`;
             }

            // Add to summary sheet
            summaryData.push([
                 index + 1, startTime, name, employeeId, position, durationText, totalScore, scoreRate, status, assessor, recordId
            ]);

            // Prepare detail sheet for this record
            const details = allRecordDetails[record.id] || [];
            const sheetName = `详情_${name}_${recordId.substring(0, 6)}`; // Create a unique sheet name
            const detailData = [
                 ['题号', '题目内容', '标准分', '得分', '用时(秒)', '备注', '标准答案', '知识来源', '模块', '题目类型', '原始题目ID'] // Headers
            ];
             details.sort((a, b) => (a.get('questionOrder') || 0) - (b.get('questionOrder') || 0));
             details.forEach((d, qIndex) => {
                 const scoreRaw = d.get('score');
                 const score = (scoreRaw !== null && scoreRaw !== undefined && !isNaN(scoreRaw)) ? Number(scoreRaw) : '未评分';
                 // **** 修改：从本地题库获取标准答案 ****
                 const questionId = d.get('questionId');
                 let standardAnswer = '未找到题库记录'; // 默认值
                 const bankQuestion = questionBank.find(q => q.id == questionId); // 使用非严格比较
                 if (bankQuestion && bankQuestion.standardAnswer) {
                     standardAnswer = bankQuestion.standardAnswer;
                 }
                 // **** 结束获取 ****
                 detailData.push([
                     qIndex + 1,
                     d.get('questionContent') || '',
                     d.get('standardScore') ?? 'N/A',
                     score,
                     d.get('durationSeconds') ?? 'N/A',
                     d.get('comment') || '',
                     standardAnswer, // <-- 使用从题库获取的答案
                     d.get('knowledgeSource') || '',
                     d.get('section') || '',
                     d.get('type') || '', // 确保字段名统一为 type
                     questionId // <-- 使用前面获取的 questionId
                 ]);
             });
             detailSheetsData[sheetName] = detailData;
        });

        // Create workbook and sheets
        const workbook = XLSX.utils.book_new();
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '测评记录总览');

        // Add detail sheets
        for (const sheetName in detailSheetsData) {
             if (Object.hasOwnProperty.call(detailSheetsData, sheetName)) {
                 const detailSheet = XLSX.utils.aoa_to_sheet(detailSheetsData[sheetName]);
                 // Basic auto column width (might need adjustments)
                 const colWidths = [];
                 detailSheetsData[sheetName][0].forEach((_, colIndex) => {
                     let maxLen = 10; // Min width
                     detailSheetsData[sheetName].forEach(row => {
                        const cellValue = row[colIndex];
                        if (cellValue != null) {
                             const cellLen = String(cellValue).length;
                             if (cellLen > maxLen) maxLen = cellLen;
                        }
                     });
                     colWidths.push({ wch: Math.min(maxLen + 2, 50) }); // Add padding, max width 50
                 });
                 detailSheet['!cols'] = colWidths;

                 XLSX.utils.book_append_sheet(workbook, detailSheet, sheetName.replace(/[/\\?*[\]]/g, '_')); // Sanitize sheet name
             }
        }

        // Generate and download file
        const filename = `测评历史记录_${formatDate(new Date())}.xlsx`;
        XLSX.writeFile(workbook, filename);
        alert(`成功导出 ${allRecords.length} 条记录到 ${filename}`);

    } catch (error) {
        console.error("导出完整历史记录失败:", error);
        alert(`导出失败: ${error.message}`);
    } finally {
         // Re-enable button
         if(exportButton) {
             exportButton.disabled = false;
             exportButton.innerHTML = '导出完整历史(Excel)';
         }
    }
}
// Bind the export function
const exportFullBtn = document.getElementById('exportHistoryBtn');
if (exportFullBtn) {
    exportFullBtn.onclick = exportFullHistoryToExcel;
}

// **** 修改：继续测评功能 (从云端恢复) ****
async function resumeAssessment(assessmentId) {
     console.log(`[resumeAssessment] Attempting to resume assessment from cloud ID: ${assessmentId}`);
     const resumeButton = event.target; // Get the button that was clicked
     if (resumeButton) resumeButton.disabled = true; // Disable button temporarily

     // Check for existing in-progress assessment
     if (localStorage.getItem('currentAssessment')) {
         try {
             const currentData = JSON.parse(localStorage.getItem('currentAssessment'));
             // Allow overwrite only if the current one is NOT the one we are resuming, AND it's in progress
             if (currentData.id !== assessmentId && currentData.status === 'in_progress') {
                  if (!confirm("当前已有正在进行的测评。继续将覆盖当前进度，确定要继续吗？")) {
                      if (resumeButton) resumeButton.disabled = false; // Re-enable button
                      return; // User cancelled
                  }
             }
             // Allow overwriting if the current one is completed or failed
             else if (currentData.status === 'completed' || currentData.status === 'failed_to_submit') {
                // Allow overwrite without confirmation
             }
             // Allow overwrite if the current one IS the one we are resuming (e.g., user refreshed history page)
             else if (currentData.id === assessmentId) {
                 // Allow overwrite without confirmation
             }

         } catch (e) {
             console.warn("Error parsing currentAssessment, proceeding with resume.", e);
             // If parsing fails, assume it's safe to overwrite
         }
     }

     try {
         // 1. Fetch Assessment from cloud
         const query = new AV.Query('Assessment');
         query.include('userPointer');
         const assessmentRecord = await query.get(assessmentId);

         if (!assessmentRecord || assessmentRecord.get('status') !== 'paused') {
             alert("无法继续测评：未找到对应的暂停记录或记录状态不正确。请刷新列表重试。");
             loadHistoryFromCloud(currentPage); // Refresh list
             if (resumeButton) resumeButton.disabled = false;
             return;
         }

         // 2. Fetch related AssessmentDetails
         const detailQuery = new AV.Query('AssessmentDetail');
         detailQuery.equalTo('assessmentPointer', assessmentRecord);
         detailQuery.limit(1000);
         const details = await detailQuery.find();

         // **** 新增：加载本地题库 ****
         let questionBank = [];
         try {
             questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
         } catch (e) {
             console.error("[resumeAssessment] Error loading question bank from localStorage:", e);
             // 如果题库加载失败，后续标准答案会是 undefined
         }
         // **** 结束加载 ****

         // 3. Build the structure needed by assessment.js
         const userInfo = assessmentRecord.get('userPointer');
         const assessmentToResume = {
              id: String(assessmentRecord.get('assessmentId')), 
              userInfo: userInfo ? {
                 name: userInfo.get('name'),
                 employeeId: userInfo.get('employeeId'),
                 station: userInfo.get('stationCode'),
                 position: assessmentRecord.get('positionCode'), // Use positionCode from Assessment
                 positionName: getPositionName(assessmentRecord.get('positionCode')),
                 objectId: userInfo.id // **** 添加 user objectId ****
              } : {},
              position: assessmentRecord.get('positionCode'),
              questions: details.map(d => {
                  // **** 修改：从本地题库获取 standardAnswer ****
                  const questionId = d.get('questionId');
                  let standardAnswerFromBank = undefined;
                  const bankQuestion = questionBank.find(q => q.id == questionId);
                  if (bankQuestion) {
                      standardAnswerFromBank = bankQuestion.standardAnswer;
                  }
                  // **** 结束获取 ****
                  return {
                     id: questionId, // 统一使用 questionId
                      content: d.get('questionContent'),
                      standardScore: d.get('standardScore'),
                      standardAnswer: standardAnswerFromBank, // <-- 使用从题库获取的答案
                      section: d.get('section'),
                      type: d.get('type'), // 统一使用 type
                      knowledgeSource: d.get('knowledgeSource')
                  };
              }).sort((a,b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999)), // Add sorting if orderIndex exists
              answers: details.reduce((acc, d) => {
                  const qId = d.get('questionId');
                  acc[qId] = {
                      score: d.get('score'),
                      comment: d.get('comment') || '',
                      startTime: null,
                      duration: Number(d.get('durationSeconds')) || 0,
                  };
                  return acc;
              }, {}),
              startTime: assessmentRecord.get('startTime')?.toISOString(),
              status: 'in_progress', // <<< Set status to in_progress for assessment page
              elapsedSeconds: Number(assessmentRecord.get('elapsedSeconds')) || 0,
              currentQuestionIndex: Number(assessmentRecord.get('currentQuestionIndex')) || 0,
              totalActiveSeconds: Number(assessmentRecord.get('totalActiveSeconds')) || 0,
              assessor: assessmentRecord.get('assessorName') // Load assessor if exists
         };

          // 4. Save to localStorage['currentAssessment']
          localStorage.setItem('currentAssessment', JSON.stringify(assessmentToResume));

         // 5. (Optional but recommended) Update cloud status?
         // Mark the cloud record as 'resumed' or delete the 'paused' state?
         // Let's just leave it as 'paused' in the cloud for simplicity. If they pause again, it will be overwritten.

         // 6. Redirect to assessment page
         console.log("[resumeAssessment] Paused assessment data loaded to currentAssessment. Redirecting...");
         window.location.href = 'assessment.html';

     } catch (error) {
          console.error(`[resumeAssessment] Error resuming assessment ID ${assessmentId}:`, error);
          alert(`继续测评失败: ${error.message}`);
          if (resumeButton) resumeButton.disabled = false; // Re-enable on error
     }
}

// **** 修改：检查本地暂存/失败的记录 (改为切换显示) ****
function checkLocalRecords() {
    console.log("[checkLocalRecords] 开始检查本地记录...");
    let history = [];
    try {
         history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    } catch (e) {
         console.error("[checkLocalRecords] Error parsing assessmentHistory:", e);
         alert("读取本地历史记录时出错！");
         return;
    }

    localUnsyncedRecords = history.filter(record => 
        record.status === 'paused' || record.status === 'failed_to_submit'
    );
    console.log(`[checkLocalRecords] 找到 ${localUnsyncedRecords.length} 条未同步记录。`);

    // 获取或创建用于显示结果的容器
    let localRecordsContainer = document.getElementById('localRecordsDisplayArea');
    if (!localRecordsContainer) {
        localRecordsContainer = document.createElement('div');
        localRecordsContainer.id = 'localRecordsDisplayArea';
        // **** 初始状态添加 d-none，使其默认隐藏 ****
        localRecordsContainer.className = 'mt-4 mb-3 p-3 border rounded bg-light shadow-sm d-none'; 
        // 插入位置逻辑保持不变
        const filterSection = document.querySelector('.filter-section'); // 查找筛选区域的容器
        const tableContainer = document.querySelector('.table-responsive'); // 查找表格的容器
        // 尝试插入到 filter-section 之后，table-responsive 之前
        if (filterSection && tableContainer && filterSection.parentNode === tableContainer.parentNode) {
             filterSection.parentNode.insertBefore(localRecordsContainer, tableContainer);
        } else if (filterSection) {
             // 如果找不到表格或父级不同，尝试插入到筛选区域之后
             filterSection.parentNode.insertBefore(localRecordsContainer, filterSection.nextSibling);
        } else {
            // Fallback: 插入到 container 顶部
            const mainContainer = document.querySelector('.container');
            if(mainContainer) mainContainer.insertBefore(localRecordsContainer, mainContainer.firstChild);
        }
    }

    // ---- 根据是否有记录进行处理 ----
    if (localUnsyncedRecords.length === 0) {
        alert("没有找到本地暂存或提交失败的测评记录。");
        // 确保容器是隐藏的
        localRecordsContainer.classList.add('d-none');
        localRecordsContainer.innerHTML = ''; // 清空内容
    } else {
        // ---- 构建列表 HTML ----
        let listHtml = '<h6 class="mb-3"><i class="bi bi-hdd-stack me-2"></i>本地暂存/失败记录</h6><ul class="list-group">';
        localUnsyncedRecords.forEach((record, index) => {
            const timestamp = formatDate(record.timestamp || record.startTime, true);
            const name = record.userInfo?.name || '未知';
            const position = getPositionName(record.position || record.userInfo?.position);
            let statusBadge = '';
            let actionsHtml = '';

            if (record.status === 'paused') {
                statusBadge = '<span class="badge bg-warning text-dark ms-2">本地暂存</span>';
                actionsHtml = `<button class="btn btn-sm btn-outline-danger" onclick="deleteLocalRecord('${record.id}')"><i class="bi bi-trash"></i> 删除本地副本</button>`;
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
                    <div>${actionsHtml}</div>
                </li>
            `;
        });
        listHtml += '</ul>';
        
        // ---- 填充内容并切换显示状态 ----
        localRecordsContainer.innerHTML = listHtml;
        localRecordsContainer.classList.toggle('d-none'); // 切换显示/隐藏
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
function formatDate(dateInput, includeTime = false) {
    let dateObject;
    if (dateInput instanceof Date) {
        dateObject = dateInput;
    } else if (typeof dateInput === 'string') {
        dateObject = new Date(dateInput);
    } else {
        return 'N/A'; // Handle undefined, null, or other types
    }

    if (!dateObject || isNaN(dateObject.getTime())) return 'N/A'; // Check if the date is valid

    try {
        const year = dateObject.getFullYear();
        const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObject.getDate().toString().padStart(2, '0');
        if (includeTime) {
            const hours = dateObject.getHours().toString().padStart(2, '0');
            const minutes = dateObject.getMinutes().toString().padStart(2, '0');
            // Optionally include seconds:
            // const seconds = dateObject.getSeconds().toString().padStart(2, '0');
            // return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } else {
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        console.error("日期格式化错误:", e, "Input:", dateInput);
        return '日期错误';
    }
}