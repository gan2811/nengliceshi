// 全局变量
let currentPage = 1;
const recordsPerPage = 10; // 每页显示多少条记录
let currentSortColumn = 'timestamp'; // 默认排序字段
let currentSortOrder = 'desc'; // 默认排序顺序 (desc: 降序, asc: 升序)
let totalRecords = 0; // 总记录数
let currentFilters = {}; // 存储当前筛选条件
let localUnsyncedRecords = []; // 存储找到的本地未同步记录
let allPositions = []; // **** 新增：存储所有岗位信息的数组 ****

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    // **** 新增：检查用户登录状态 ****
    if (typeof AV === 'undefined' || !AV.User.current()) {
        console.log("用户未登录，正在重定向到首页...");
        // 可以在这里显示一个短暂的提示，然后跳转
        // displayError("请先登录后访问历史记录。");
        window.location.href = 'index.html'; // 重定向到首页
        return; // 阻止后续代码执行
    }
    // **** 结束新增 ****

    // 检查 LeanCloud SDK
    if (typeof AV === 'undefined') {
        displayError("LeanCloud SDK 未加载，请检查 HTML 文件。");
        return;
    }

    // **** 新增：首先获取所有岗位信息 ****
    await fetchAllPositions();

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

    // **** 修改：查找正确的按钮 ID 并绑定事件 ****
    const uploadBtn = document.getElementById('uploadToCloudBtn'); // **** 直接查找新的 ID ****
    if (uploadBtn) {
        uploadBtn.onclick = handleUploadToCloud; // **** 直接绑定处理函数 ****
        // 如果需要，可以保留或添加样式修改
        // uploadBtn.classList.remove('btn-primary'); 
        // uploadBtn.classList.add('btn-info'); 
    } else {
        // **** 添加错误处理，以防按钮找不到 ****
        console.error("Button with ID 'uploadToCloudBtn' not found in DOM on initialization!");
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

    // **** 新增：设置文件上传监听器 ****
    setupFileUploadListener();

    // **自动加载第一页云端数据**
    loadHistoryFromCloud(currentPage); // Start loading cloud data

    // **** 修改：移除页面加载时自动检查本地记录 ****
    // checkLocalRecords(); // Automatically check local records on load

});

// **** 新增：获取所有岗位信息的函数 ****
async function fetchAllPositions() {
    console.log("Fetching all job positions from LeanCloud...");
    try {
        const query = new AV.Query('Position');
        query.limit(1000); // Assume less than 1000 positions
        const positions = await query.find();
        allPositions = positions.map(p => ({
            objectId: p.id,
            code: p.get('positionCode'), // Assuming field name is 'positionCode'
            name: p.get('positionName')  // Assuming field name is 'positionName'
        }));
        // **** 新增日志：打印获取到的岗位数据 ****
        console.log(`Fetched ${allPositions.length} positions. Data (first 10):`, JSON.stringify(allPositions.slice(0, 10)));
        // 可选：填充岗位筛选下拉框 (如果需要且 HTML 中有对应元素)
        populatePositionFilter();
    } catch (error) {
        console.error("获取岗位列表失败:", error);
        // Display error to user? Or just log it?
        // displayError("无法加载岗位列表，部分信息可能无法显示。");
        allPositions = []; // Ensure it's empty on error
    }
}

// **** 新增：填充岗位筛选下拉框 (可选) ****
function populatePositionFilter() {
    const filterSelect = document.getElementById('positionFilter');
    if (!filterSelect) return; // 如果 HTML 中没有这个元素，则跳过

    // 清空现有选项 (保留"全部")
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }

    // 添加从 allPositions 获取的选项
    allPositions.forEach(pos => {
        const option = document.createElement('option');
        option.value = pos.code; // 使用 code 作为值
        option.textContent = pos.name || pos.code; // 显示 name，如果 name 没有则显示 code
        filterSelect.appendChild(option);
    });
}

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
    // **** 新增：包含 UserProfile 关联的岗位和站点指针 ****
    query.include('userPointer.positionPointer');
    query.include('userPointer.stationPointer');

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

                 // **** 修改：正确获取 station 和 position 信息 ****
                 const stationPointer = userInfo ? userInfo.get('stationPointer') : null;
                 const positionPointer = userInfo ? userInfo.get('positionPointer') : null;
                 const stationName = stationPointer ? stationPointer.get('stationName') : '未知';
                 const positionName = positionPointer ? positionPointer.get('positionName') : '未知';

                 const localRecord = {
                     id: record.id,
                     userInfo: userInfo ? {
                         // **** 新增：包含 UserProfile 的 ID ****
                         id: userInfo.id, // 从 UserProfile 对象获取 ID
                         objectId: userInfo.id, // 也存储为 objectId 以保持一致性
                         name: userInfo.get('name'),
                         employeeId: userInfo.get('employeeId'),
                         station: stationName,
                         position: positionName,
                         positionName: positionName // 确保也包含 positionName
                     } : {},
                     position: positionName,
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
        
        // **** 删除调试日志 ****
        // console.log(`[populateTable] Record ID: ${record.id} - Raw UserInfo object received:`, JSON.stringify(userInfo)); 
        const positionPointerObject = userInfo ? userInfo.get('positionPointer') : null;
        // console.log(`[populateTable] Record ID: ${record.id} - Value from userInfo.get('positionPointer'):`, JSON.stringify(positionPointerObject));
        // **** 结束删除 ****

        const name = userInfo ? userInfo.get('name') : 'N/A';
        const employeeId = userInfo ? userInfo.get('employeeId') : 'N/A';
        
        // **** 修改：通过指针链获取岗位名称 ****
        // const positionPointer = userInfo ? userInfo.get('positionPointer') : null; // 使用上面获取的 positionPointerObject
        const positionPointer = positionPointerObject; // 直接使用上面获取的对象
        
        // **** 尝试从 UserProfile 获取岗位名称 (根据指针) ****
        let position = '未知';
        // **** 修改：检查 positionPointer 对象本身及其 ID ****
        if (positionPointer && positionPointer.id) { 
            const targetPositionId = positionPointer.id;
            // **** 删除调试日志 ****
            // console.log(`[populateTable] Record ID: ${record.id}, User ID: ${userInfo?.id}, Looking for Position ID: ${targetPositionId} (Type: ${typeof targetPositionId})`);
            const posObj = allPositions.find(p => {
                 return p.objectId === targetPositionId;
            });
            if (posObj) {
                position = posObj.name || posObj.code || '未命名岗位'; 
                // **** 删除调试日志 ****
                // console.log(`[populateTable] Found Position Object in allPositions:`, JSON.stringify(posObj), `Setting position to: ${position}`);
        } else {
                 console.error(`[populateTable] Position object with ID ${targetPositionId} NOT FOUND in allPositions.`);
                // Check for type mismatch just in case
                const posObjLoose = allPositions.find(p => p.objectId == targetPositionId);
                if (posObjLoose) {
                    console.warn(`[populateTable] Position ID ${targetPositionId} found with loose comparison (==), potential type mismatch. Found obj:`, JSON.stringify(posObjLoose));
                }
            }
        } else {
            // **** 删除调试日志 ****
            // console.warn(`[populateTable] Record ID: ${record.id}, User ID: ${userInfo?.id} - Failed check: positionPointer object is missing or lacks an ID. Received positionPointer: ${JSON.stringify(positionPointer)}`);
            // 保留一个基本的警告可能仍然有用，但可以简化
             if (userInfo && !positionPointer) { // 只在 userInfo 存在但 positionPointer 不存在时警告
                 console.warn(`[populateTable] UserProfile ${userInfo.id} for Record ${record.id} is missing positionPointer.`);
             }
        }
        
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
    // **** 新增: 存储 assessmentId 到 modal body 的 dataset ****
    detailModalBody.dataset.assessmentId = assessmentId;
    
    detailModalBody.innerHTML = '<div id="detailModalContentToExport"><p class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 加载详情中...</p></div>';
    
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
        // **** 新增：包含 UserProfile 关联的指针 ****
        query.include('userPointer.positionPointer');
        query.include('userPointer.stationPointer');
        const assessment = await query.get(assessmentId);

        // 查询关联的 AssessmentDetail
        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', assessment);
        detailQuery.limit(1000); // Assume max 1000 questions per assessment
        const details = await detailQuery.find();

        // 构建详情 HTML
        let htmlContent = buildDetailHtml(assessment, details);
        // **** 修改: 将内容放入带有 ID 的 div 中 ****
        detailModalBody.innerHTML = `<div id="detailModalContentToExport">${htmlContent}</div>`;

    } catch (error) {
        console.error("加载详情失败:", error);
        // **** 修改: 错误信息也放入带有 ID 的 div 中 ****
        detailModalBody.innerHTML = `<div id="detailModalContentToExport"><p class="text-danger text-center">加载详情失败: ${error.message || '未知错误'}</p></div>`;
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
    // **** 修改：通过指针链获取站点和岗位名称 ****
    const stationPointer = userInfo ? userInfo.get('stationPointer') : null;
    const station = stationPointer ? stationPointer.get('stationName') : '未知';
    const positionPointer = userInfo ? userInfo.get('positionPointer') : null;
    const position = positionPointer ? positionPointer.get('positionName') : '未知';
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

    // **** 新增：添加居中的"测评总览"标题 ****
    let headerHtml = `<h5 class="text-center text-primary mb-3"><i class="bi bi-clipboard-check me-2"></i>测评总览</h5>`;

    let tableHtml = `
        <h5 class="text-center text-primary mb-3"><i class="bi bi-clipboard-check me-2"></i>测评总览</h5>
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
    
    // **** 新增：在返回的 HTML 中确保按钮调用 exportDetail() ****
    // (这里假设模态框的 footer 是在别处定义的或者需要在这里动态添加)
    // 如果 footer 是固定的，只需确保按钮的 onclick='exportDetail()'
    // 如果需要在 buildDetailHtml 中生成整个 modal content 包括 footer:
    /*
    let footerHtml = `
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
            <button type="button" class="btn btn-primary" onclick="exportDetail()">导出</button>
        </div>
    `;
    return tableHtml + footerHtml; // Append footer if generated here
    */
   
    // 仅返回表格内容，假设 footer 在 history.html 中且按钮已设置 onclick="exportDetail()"
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

    // **** 新增：加载本地题库 ****
    let questionBank = [];
    try {
        const bankData = localStorage.getItem('questionBank');
        if (bankData) {
            questionBank = JSON.parse(bankData);
        }
    } catch (e) {
        console.error("加载题库失败 (用于导出详情):", e);
        // 即使题库加载失败，也继续导出，只是标准答案会显示为'未找到'
    }
    // **** 结束加载题库 ****

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

// **** 修改：恢复测评，增加本地状态检查 ****
async function resumeAssessment(assessmentId) {
    console.log(`Attempting to resume assessment with ID: ${assessmentId}`);

    // 1. 检查本地是否存在不相关的进行中测评
    const localStateKey = 'activeAssessmentState'; // 使用与 assessment.js 统一的键名
    let localState = null;
         try {
        const storedState = localStorage.getItem(localStateKey);
        if (storedState) {
            localState = JSON.parse(storedState);
            console.log("Found local assessment state:", localState);
        }
         } catch (e) {
        console.error("Error reading local assessment state:", e);
        // 出错时，为安全起见，可以当作存在冲突，或者忽略本地状态
        // 这里选择忽略本地状态错误，允许继续恢复
        localState = null; 
    }

    let proceedToResume = true; // 默认允许恢复

    // 检查是否存在冲突的本地状态 (状态为 '进行中' 或 'paused' 且 ID 不同)
    if (localState && 
        (localState.status === '进行中' || localState.status === 'paused') && // 检查状态
        localState.objectId !== assessmentId && // 确保 ID 不同
        localState.assessmentId !== assessmentId) { // 同时也检查前端生成的 ID
        
        console.warn(`Conflict: Found an unrelated active/paused assessment in local storage (ID: ${localState.assessmentId || localState.objectId}).`);
        
        // 弹出确认对话框 (使用您截图中的文本)
        proceedToResume = confirm(
            '当前已有正在进行的测评。继续将覆盖当前进度，确定要继续吗？'
        );

        if (proceedToResume) {
            console.log("User confirmed overwrite. Clearing local state before resuming.");
            // 用户确认覆盖，清除本地状态
            localStorage.removeItem(localStateKey);
        } else {
            console.log("User cancelled overwrite. Aborting resume.");
        }
    }

    // 2. 如果允许恢复 (没有冲突或用户确认覆盖)，则跳转
    if (proceedToResume) {
        console.log(`Proceeding to navigate to assessment.html?resumeId=${assessmentId}`);
         window.location.href = `assessment.html?resumeId=${assessmentId}`;
    } else {
         // 用户取消，可以不做任何事，或者给个提示
         // alert("恢复操作已取消。");
     }
}

// **** 结束修改 ****

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
     // **** 从 analysis.js 合并查找逻辑 ****
     // 1. Check standard code map
     const positionMap = { 
         'duty_station': '值班站长', 
         'station_duty': '车站值班员', 
         'station_safety': '站务安全员',
         // Add other known codes here
         'ticketing_clerk': '票务员' // Example added
     };
     if (positionMap[positionCode]) {
         return positionMap[positionCode];
     }
     // 2. Check if the code itself is a known name
     if (['值班站长', '车站值班员', '站务安全员', '票务员'].includes(positionCode)) {
         return positionCode;
     }
     // 3. Fallback: try finding in the globally loaded allPositions (if available)
     if (typeof allPositions !== 'undefined' && Array.isArray(allPositions)) {
         const posObj = allPositions.find(p => p.code === positionCode);
         if (posObj && posObj.name) {
             return posObj.name;
         }
     }
     // 4. Final fallback
     return positionCode || '未知';
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

// **** 新增：上传到云端的处理函数 ****
function handleUploadToCloud() {
    // **** 新增日志：确认函数调用和元素查找 ****
    console.log("[handleUploadToCloud] Function called.");
    const fileInput = document.getElementById('jsonFileInput');
    console.log("[handleUploadToCloud] Found file input element:", fileInput);

    // Trigger the hidden file input click
    if (fileInput) {
        fileInput.click();
    } else {
        console.error("JSON file input element not found!");
        alert("无法找到文件上传组件，请检查页面 HTML。")
    }
}

// **** 新增：文件选择事件监听器 ****
function setupFileUploadListener() {
    const fileInput = document.getElementById('jsonFileInput');
    if (!fileInput) return;

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        if (!file.name.toLowerCase().endsWith('.json')) {
            alert("请选择有效的 JSON 文件 (.json)");
            fileInput.value = ''; // Clear the input
            return;
        }

        console.log(`Selected file: ${file.name}, size: ${file.size} bytes`);
        showUploadProgress('开始读取文件...'); // Display initial progress

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const fileContent = e.target.result;
                const data = JSON.parse(fileContent);

                if (!data || !Array.isArray(data.assessmentHistory)) {
                    throw new Error("JSON 文件格式无效，缺少 'assessmentHistory' 数组。");
                }

                const recordsToUpload = data.assessmentHistory;
                console.log(`Parsed ${recordsToUpload.length} records from JSON.`);

                if (recordsToUpload.length === 0) {
                    alert("JSON 文件中没有找到有效的测评记录。");
                    hideUploadProgress();
                    return;
                }

                // **** 调用核心上传逻辑 ****
                await processAndUploadRecords(recordsToUpload);

            } catch (error) {
                console.error("处理或上传 JSON 文件时出错:", error);
                alert(`处理 JSON 文件失败: ${error.message}`);
                hideUploadProgress();
            } finally {
                // Reset file input to allow selecting the same file again
                fileInput.value = '';
            }
        };

        reader.onerror = (error) => {
            console.error("读取文件时出错:", error);
            alert("读取文件失败。");
            hideUploadProgress();
            fileInput.value = ''; // Clear the input
        };

        reader.readAsText(file); // Start reading the file
    });
}

// **** 新增：显示上传进度的辅助函数 ****
function showUploadProgress(message) {
    let progressArea = document.getElementById('uploadProgressArea');
    if (!progressArea) {
        progressArea = document.createElement('div');
        progressArea.id = 'uploadProgressArea';
        progressArea.className = 'mt-3 mb-3 p-3 border rounded bg-light';
        // Insert it before the table container or filter section
        const tableContainer = document.querySelector('.table-responsive');
        const filterSection = document.querySelector('.filter-section');
        if (tableContainer) {
             tableContainer.parentNode.insertBefore(progressArea, tableContainer);
        } else if (filterSection) {
             filterSection.parentNode.insertBefore(progressArea, filterSection.nextSibling);
        } else {
             // Fallback to body beginning
            document.body.insertBefore(progressArea, document.body.firstChild);
        }
    }
    progressArea.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span id="uploadProgressMessage">${message}</span>
        </div>
    `;
    progressArea.style.display = 'block';
}

// **** 新增：隐藏上传进度的辅助函数 ****
function hideUploadProgress() {
    const progressArea = document.getElementById('uploadProgressArea');
    if (progressArea) {
        progressArea.style.display = 'none';
        progressArea.innerHTML = ''; // Clear content
    }
}

// **** 新增：核心上传处理函数 ****
async function processAndUploadRecords(records) {
    const totalRecords = records.length;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < totalRecords; i++) {
        const record = records[i];
        const progressMessage = `正在上传第 ${i + 1} / ${totalRecords} 条记录 (${record.userInfo?.name || '未知用户'})...`;
        console.log(progressMessage);
        showUploadProgress(progressMessage);

        try {
            // 查找或创建用户、站点、岗位
            const userPointer = await findOrCreateUserProfile(record.userInfo);
            const stationPointer = await findOrCreateStation(record.userInfo?.station);
            const positionPointer = await findOrCreatePosition(record.userInfo?.position);

            // **** 关键：在创建 Assessment 前，更新 UserProfile 的 station 和 position 指针 ****
            if (userPointer && (stationPointer || positionPointer)) {
                 // **** 修改：使用 UserProfile ****
                 let userToUpdate = AV.Object.createWithoutData('UserProfile', userPointer.id); 
                 let needsUpdate = false;
                 // **** 注意：需要先 fetch userPointer 以获取最新的关联数据 ****
                 try {
                    await userPointer.fetch({ include: ['stationPointer', 'positionPointer'] });
                 } catch (fetchError) {
                     console.warn(`Failed to fetch user ${userPointer.id} before updating pointers:`, fetchError);
                     // 如果 fetch 失败，仍然尝试更新，但可能基于旧数据进行比较
                 }

                 // 检查并设置 stationPointer
                 const currentStationId = userPointer.get('stationPointer')?.id;
                 if (stationPointer && currentStationId !== stationPointer.id) {
                     userToUpdate.set('stationPointer', stationPointer);
                     needsUpdate = true;
                     console.log(`Updating UserProfile ${userPointer.id} stationPointer from ${currentStationId || 'null'} to ${stationPointer.id}`);
                 } else if (!stationPointer && currentStationId) {
                     // 如果 JSON 中没有站点但 UserProfile 中有，可以选择清除或保留，这里选择保留
                     // userToUpdate.unset('stationPointer'); needsUpdate = true;
                     // console.log(`Keeping existing stationPointer ${currentStationId} for UserProfile ${userPointer.id} as new one is null.`);
                 } else {
                    // console.log(`StationPointer for UserProfile ${userPointer.id} does not need update.`);
                 }

                 // 检查并设置 positionPointer
                 const currentPositionId = userPointer.get('positionPointer')?.id;
                 if (positionPointer && currentPositionId !== positionPointer.id) {
                     userToUpdate.set('positionPointer', positionPointer);
                     needsUpdate = true;
                     console.log(`Updating UserProfile ${userPointer.id} positionPointer from ${currentPositionId || 'null'} to ${positionPointer.id}`);
                 } else if (!positionPointer && currentPositionId) {
                     // 如果 JSON 中没有岗位但 UserProfile 中有，选择保留
                     // userToUpdate.unset('positionPointer'); needsUpdate = true;
                      // console.log(`Keeping existing positionPointer ${currentPositionId} for UserProfile ${userPointer.id} as new one is null.`);
                 } else {
                    // console.log(`PositionPointer for UserProfile ${userPointer.id} does not need update.`);
                 }

                 if (needsUpdate) {
                     try {
                         await userToUpdate.save();
                         console.log(`Successfully updated UserProfile ${userPointer.id} with Station/Position pointers.`);
                     } catch (updateError) {
                         console.error(`Failed to update UserProfile ${userPointer.id} pointers:`, updateError);
                         // Decide if this is a critical failure for the record upload
                         errors.push(`记录 ${i+1} (${record.userInfo?.name}): 更新用户站点/岗位指针失败 - ${updateError.message}`);
                         errorCount++;
                         continue; // 跳过这条记录，因为用户关联可能不正确
                     }
                 }
            }

            // 创建 Assessment 对象
            const Assessment = AV.Object.extend('Assessment');
            const assessment = new Assessment();

            // --- 映射字段 --- 
            assessment.set('userPointer', userPointer); 
            // 使用已找到/创建的 User Pointer
            assessment.set('assessorName', record.assessor);
            assessment.set('startTime', record.startTime ? new Date(record.startTime) : null);
            assessment.set('endTime', record.timestamp ? new Date(record.timestamp) : null);
            assessment.set('durationMinutes', record.duration);
            assessment.set('totalScore', record.score?.totalScore);
            assessment.set('maxPossibleScore', record.score?.maxScore);
            assessment.set('scoreRate', record.score?.scoreRate);
            assessment.set('status', record.status || 'completed'); // Default to completed if not present
            assessment.set('elapsedSeconds', record.elapsedSeconds);
            assessment.set('currentQuestionIndex', record.currentQuestionIndex);
            assessment.set('totalActiveSeconds', record.totalActiveSeconds);
            // **** 添加 positionCode 和 stationCode 到 Assessment 表 ****
            if (positionPointer) {
                assessment.set('positionCode', positionPointer.get('positionCode')); // Assuming positionPointer has code
            }
            if (stationPointer) {
                assessment.set('stationCode', stationPointer.get('stationCode')); // Assuming stationPointer has code
            }
            assessment.set('source', 'json_import'); // 标记来源

            // 保存 Assessment
            const savedAssessment = await assessment.save();
            console.log(`  Saved Assessment ${savedAssessment.id}`);
            const assessmentPointer = AV.Object.createWithoutData('Assessment', savedAssessment.id);

            // 创建 AssessmentDetail 对象
            const detailsToSave = [];
            if (record.questions && record.answers) {
                record.questions.forEach((q, index) => {
                    const answerData = record.answers[q.id];
                    if (answerData) {
                        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
                        const detail = new AssessmentDetail();
                        detail.set('assessmentPointer', assessmentPointer);
                        
                        // **** 修改：处理 questionId 类型 ****
                        let questionIdNum;
                        try {
                            if (q.id === undefined || q.id === null) {
                                throw new Error('Question ID is missing');
                            }
                            questionIdNum = parseInt(q.id, 10);
                            if (isNaN(questionIdNum)) {
                                throw new Error(`Question ID '${q.id}' is not a valid number.`);
                            }
                        } catch(e) {
                            console.error(`[processAndUploadRecords] Invalid Question ID found: ${q.id}. Skipping detail. Error: ${e.message}`);
                            // **** 修改：使用 return 跳过 forEach 的当前迭代 ****
                            return; // 跳过这个错误的 detail 记录
                        }
                        detail.set('questionId', questionIdNum); // **** 使用数字保存 ****
                        
                        detail.set('questionContent', q.content);
                        detail.set('standardScore', q.standardScore);
                        
                        // **** 修改：处理 standardAnswer 类型 ****
                        let standardAnswerValue = q.standardAnswer;
                        if (typeof standardAnswerValue === 'string') {
                            // 如果是字符串 (特别是 "")，但字段期望 Object，则设为 null
                            // 或者如果有时标准答案会是 JSON 字符串，可以尝试解析：
                            // try {
                            //     standardAnswerValue = JSON.parse(standardAnswerValue);
                            //     if (typeof standardAnswerValue !== 'object') standardAnswerValue = null;
                            // } catch (e) {
                            //      standardAnswerValue = null; 
                            // }
                            console.warn(`[processAndUploadRecords] Converting standardAnswer from String "${standardAnswerValue.substring(0, 50)}..." to null for Question ID ${q.id}`);
                            standardAnswerValue = null; 
                        }
                        detail.set('standardAnswer', standardAnswerValue); // 使用处理后的值
                        
                        detail.set('section', q.section);
                        detail.set('type', q.type);
                        detail.set('knowledgeSource', q.knowledgeSource);
                        detail.set('score', answerData.score);
                        detail.set('comment', answerData.comment);
                        detail.set('durationSeconds', answerData.duration);
                        // detail.set('startTime', answerData.startTime ? new Date(answerData.startTime) : null); // Start time per question often not needed
                        detail.set('questionOrder', index); // 保存题目顺序
                        detailsToSave.push(detail);
                    }
                });
            }

            // 批量保存 AssessmentDetail
            if (detailsToSave.length > 0) {
                await AV.Object.saveAll(detailsToSave);
                console.log(`  Saved ${detailsToSave.length} AssessmentDetail records.`);
            }

            successCount++;
        } catch (error) {
            console.error(`上传第 ${i + 1} 条记录 (${record.userInfo?.name}) 时失败:`, error);
            errors.push(`记录 ${i + 1} (${record.userInfo?.name}): ${error.message}`);
            errorCount++;
            // 继续处理下一条记录
        }
    }

    // 完成后的反馈
    hideUploadProgress();
    let finalMessage = `JSON 文件上传完成！\n成功上传 ${successCount} 条记录。`;
    if (errorCount > 0) {
        finalMessage += `\n失败 ${errorCount} 条记录。\n错误详情请查看浏览器控制台。`;
        console.error("上传过程中的错误:", errors);
        alert(finalMessage + '\n\n错误详情:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...' : ''));
    } else {
        alert(finalMessage);
    }

    // 刷新表格显示新数据
    loadHistoryFromCloud(1);
}

// **** 新增：查找或创建用户 (修改为 UserProfile) ****
async function findOrCreateUserProfile(userInfo) {
    if (!userInfo || userInfo.employeeId === undefined || userInfo.employeeId === null) {
        throw new Error("用户信息或工号缺失，无法查找或创建用户。");
    }

    // **** 修改：将 employeeId 转换为 Number ****
    let employeeIdNum;
    try {
        employeeIdNum = parseInt(userInfo.employeeId, 10); // 尝试转换为数字
        if (isNaN(employeeIdNum)) {
            throw new Error(`工号 '${userInfo.employeeId}' 不是有效的数字。`);
        }
    } catch (e) {
         throw new Error(`处理工号 '${userInfo.employeeId}' 时出错: ${e.message}`);
    }

    // 1. 按 employeeId (Number) 查找 UserProfile
    const query = new AV.Query('UserProfile'); 
    query.equalTo('employeeId', employeeIdNum); // **** 使用数字比较 ****
    query.include('stationPointer'); 
    query.include('positionPointer');
    let userProfile = await query.first();

    if (userProfile) {
        console.log(`  Found existing UserProfile: ${userProfile.id} for employeeId: ${employeeIdNum}`);
        return userProfile; 
    } else {
        console.log(`  UserProfile with employeeId ${employeeIdNum} not found. Creating new UserProfile...`);
        // 2. 创建新 UserProfile
        const UserProfile = AV.Object.extend('UserProfile');
        const newUserProfile = new UserProfile();
        newUserProfile.set('name', userInfo.name || `员工${employeeIdNum}`);
        newUserProfile.set('employeeId', employeeIdNum); // **** 使用数字保存 ****
        
        const stationPointer = await findOrCreateStation(userInfo.station);
        const positionPointer = await findOrCreatePosition(userInfo.position);
        if (stationPointer) newUserProfile.set('stationPointer', stationPointer);
        if (positionPointer) newUserProfile.set('positionPointer', positionPointer);

        try {
            await newUserProfile.save(); 
            console.log(`  Created new UserProfile: ${newUserProfile.id}`);
            return newUserProfile; 
        } catch (error) {
            console.error("创建新 UserProfile 时出错:", error);
            throw new Error(`创建 UserProfile 失败: ${error.message}`);
        }
    }
}

// **** 新增：查找或创建站点 ****
async function findOrCreateStation(stationCode) {
    if (!stationCode) return null; // 如果没有提供 stationCode，则不处理

    const query = new AV.Query('Station');
    query.equalTo('stationCode', stationCode);
    let station = await query.first();

    if (station) {
        console.log(`  Found existing Station: ${station.id} for code: ${stationCode}`);
        return station; // 返回找到的站点对象 (Pointer)
    } else {
        console.log(`  Station with code ${stationCode} not found. Creating new station...`);
        const Station = AV.Object.extend('Station');
        const newStation = new Station();
        newStation.set('stationCode', stationCode);
        // **** 尝试从已知映射获取名称，否则使用 code 作为 name ****
        const stationMap = { /* ... 你的站点代码到名称的映射 ... */
             'grand_hall': '大礼堂', 'seven_hills': '七星岗', 'houbao': '后堡', 
             'wanshou': '万寿路', 'nanhu': '南湖', 'lanhua': '兰花路'
        }; 
        newStation.set('stationName', stationMap[stationCode] || stationCode); 
        try {
            await newStation.save();
            console.log(`  Created new Station: ${newStation.id} with name ${newStation.get('stationName')}`);
            return newStation;
        } catch (error) {
            console.error("创建新站点时出错:", error);
            throw new Error(`创建站点失败: ${error.message}`);
        }
    }
}

// **** 新增：查找或创建岗位 ****
async function findOrCreatePosition(positionCode) {
    if (!positionCode) return null; // 如果没有提供 positionCode，则不处理

    const query = new AV.Query('Position');
    query.equalTo('positionCode', positionCode);
    let position = await query.first();

    if (position) {
        console.log(`  Found existing Position: ${position.id} for code: ${positionCode}`);
        return position; // 返回找到的岗位对象 (Pointer)
    } else {
        console.log(`  Position with code ${positionCode} not found. Creating new position...`);
        const Position = AV.Object.extend('Position');
        const newPosition = new Position();
        newPosition.set('positionCode', positionCode);
        // **** 尝试从已知映射获取名称，否则使用 code 作为 name ****
        const positionMap = { /* ... 你的岗位代码到名称的映射 ... */
             'duty_station': '值班站长', 'station_duty': '车站值班员', 'station_safety': '站务安全员'
         }; 
        newPosition.set('positionName', positionMap[positionCode] || positionCode);
        try {
            await newPosition.save();
            console.log(`  Created new Position: ${newPosition.id} with name ${newPosition.get('positionName')}`);
            return newPosition;
        } catch (error) {
            console.error("创建新岗位时出错:", error);
            throw new Error(`创建岗位失败: ${error.message}`);
        }
    }
}

// **** 新增：导出详情为 PDF 的函数 ****
async function exportDetail() {
    const detailModalBody = document.getElementById('detailModalBody'); // Get the modal body
    const exportButton = document.querySelector('#detailModal .modal-footer button[onclick^="exportDetail"]');
    
    if (!detailModalBody) {
        console.error("无法找到详情模态框内容区域 (detailModalBody)!");
        alert("导出错误：无法找到内容区域。");
        return;
    }

    // Find the content div *within* the modal body
    let contentElement = document.getElementById('detailModalContentToExport');
    if (!contentElement) {
        console.error("无法找到要导出的内容元素 (#detailModalContentToExport)!");
        alert("导出错误：无法找到内容。");
        return;
    }
    
    if (!window.jspdf || !window.html2canvas) {
         console.error("jsPDF or html2canvas library not loaded!");
         alert("导出错误：所需库未加载，请检查网络连接或联系管理员。");
         return;
    }
    
    if (exportButton) exportButton.disabled = true;
    const originalButtonText = exportButton ? exportButton.innerHTML : '';
    if (exportButton) exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 生成中...';

    try {
        // --- 1. 获取当前显示的 Assessment 数据 (需要从 DOM 或 内存 获取) ---
        // **重要:** 我们需要获取与当前模态框内容对应的 assessment 数据。
        // 最好的方式是让 viewDetail 查询后，将 assessment 和 details 存到某个全局变量或传递给 exportDetail。
        // 假设 viewDetail 将其存到了全局变量 `currentDetailData`
        // let currentRecordData = window.currentDetailDataForExport; // Example global variable
        // **临时方案: 尝试从 DOM 中提取 assessment ID 再重新查询** 
        // (效率较低，但避免修改 viewDetail 传递数据)
        let currentRecordData = null;
        // We need the assessment ID. How to get it here? 
        // Option 1: Add it as a data attribute to the modal or contentElement when viewDetail runs.
        // Option 2: Parse it from somewhere in the existing contentElement HTML (less reliable).
        // Let's assume we can get assessmentId somehow (e.g., from a data attribute on the button or modal)
        const assessmentId = detailModalBody.dataset.assessmentId; // Needs viewDetail to set this: detailModalBody.dataset.assessmentId = assessmentId;
        
        if (!assessmentId) {
             console.error("无法获取当前详情记录的 Assessment ID!");
             throw new Error("无法确定要分析的记录 ID。");
        }
        
        console.log(`[exportDetail] Re-fetching data for Assessment ID: ${assessmentId}`);
        const query = new AV.Query('Assessment');
        query.include('userPointer');
        query.include('userPointer.positionPointer');
        query.include('userPointer.stationPointer');
        const assessment = await query.get(assessmentId);

        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', assessment);
        detailQuery.limit(1000);
        const details = await detailQuery.find();
        
        // Reconstruct the record object needed by analysis functions
        currentRecordData = {
            id: assessment.id,
            userInfo: assessment.get('userPointer')?.attributes, // Get attributes
            position: assessment.get('userPointer')?.get('positionPointer')?.get('positionName'), // Adjust based on actual structure
            assessor: assessment.get('assessorName'),
            timestamp: assessment.get('endTime')?.toISOString(),
            startTime: assessment.get('startTime')?.toISOString(),
            duration: assessment.get('durationMinutes'),
            score: {
                totalScore: assessment.get('totalScore'),
                maxScore: assessment.get('maxPossibleScore'),
                scoreRate: assessment.get('scoreRate'),
            },
            questions: details.map(d => ({ // Ensure all needed fields are here
                 id: d.get('questionId'),
                 content: d.get('questionContent'),
                 standardScore: d.get('standardScore'),
                 standardAnswer: d.get('standardAnswer'), // Might need parsing if object
                 section: d.get('section'),
                 type: d.get('type'),
                 knowledgeSource: d.get('knowledgeSource')
            })),
            answers: details.reduce((acc, d) => {
                const qId = d.get('questionId');
                acc[qId] = {
                    score: d.get('score'),
                    comment: d.get('comment'),
                    duration: d.get('durationSeconds'),
                };
                return acc;
            }, {}),
            status: assessment.get('status'),
            totalActiveSeconds: assessment.get('totalActiveSeconds'),
            // ... add any other fields needed by analysis functions ...
        };
        // console.log("Data for analysis:", currentRecordData);

        if (!currentRecordData) {
            throw new Error("无法获取生成分析报告所需的数据。");
        }

        // --- 2. 生成分析报告 HTML ---
        console.log("Generating analysis HTML...");
        const analysisHtml = buildAnalysisHtmlForPdf(currentRecordData);
        // console.log("Analysis HTML:", analysisHtml);

        // --- 3. 追加 HTML 到待导出内容 --- 
        // Ensure contentElement is the correct container
        contentElement.innerHTML += analysisHtml; // Append the analysis
        console.log("Appended analysis HTML to content for export.");

        // --- 4. 执行截图和 PDF 生成 (代码来自之前) ---
        const { jsPDF } = window.jspdf; 
        console.log("Starting html2canvas capture...");
        const canvas = await html2canvas(contentElement, { scale: 2, useCORS: true, logging: true }); // Enable logging
        console.log("html2canvas capture finished.");
        const imgData = canvas.toDataURL('image/png');

        const imgWidthOrig = canvas.width / 2; 
        const imgHeightOrig = canvas.height / 2; 

        const pdfWidth = 595.28;
        const pdfHeight = 841.89;
        const margin = 40; 
        const contentWidth = pdfWidth - margin * 2;
        const contentHeight = pdfHeight - margin * 2;

        const scaleRatio = contentWidth / imgWidthOrig;
        const imgWidthScaled = contentWidth;
        const imgHeightScaled = imgHeightOrig * scaleRatio;

        const pdf = new jsPDF('p', 'pt', 'a4');
        let positionY = margin; 

        if (imgHeightScaled <= contentHeight) {
            pdf.addImage(imgData, 'PNG', margin, positionY, imgWidthScaled, imgHeightScaled);
            console.log("Added single page image to PDF.");
        } else {
            console.log("Image too tall, splitting into multiple pages...");
            let remainingHeight = imgHeightOrig;
            let ySlicePosition = 0;
            const sliceScale = 2; 
            
            while (remainingHeight > 0) {
                const sliceHeightOrig = Math.min(remainingHeight, contentHeight / scaleRatio);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceHeightOrig * sliceScale;
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCtx.drawImage(canvas, 0, ySlicePosition * sliceScale, canvas.width, sliceHeightOrig * sliceScale, 0, 0, canvas.width, sliceHeightOrig * sliceScale);

                const sliceImgData = sliceCanvas.toDataURL('image/png');
                const sliceImgHeightScaled = sliceHeightOrig * scaleRatio;

                pdf.addImage(sliceImgData, 'PNG', margin, positionY, imgWidthScaled, sliceImgHeightScaled);
                console.log(`Added page slice, height: ${sliceHeightOrig.toFixed(1)}orig / ${sliceImgHeightScaled.toFixed(1)}scaled`);

                remainingHeight -= sliceHeightOrig;
                ySlicePosition += sliceHeightOrig;

                if (remainingHeight > 0) {
                    pdf.addPage();
                    positionY = margin;
                    console.log("Added new page.");
                }
            }
        }

        // --- Generate filename (code from before) ---
        let filename = '测评详情及分析.pdf'; // Modified default name
        try {
            const userName = assessment.get('userPointer')?.get('name') || '未知用户';
            const completionDateInput = assessment.get('startTime'); // **** 修改：使用 startTime **** // Get the raw input
            let dateStr = 'YYYYMMDD';
            let dateObject = null;

            // Attempt to get a valid Date object
            if (completionDateInput instanceof Date) {
                dateObject = completionDateInput;
            } else if (typeof completionDateInput === 'string') {
                dateObject = new Date(completionDateInput); // Try parsing the string
            }

            // Check if we have a valid Date object now
            if (dateObject && !isNaN(dateObject.getTime())) {
                const year = dateObject.getFullYear();
                const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
                const day = dateObject.getDate().toString().padStart(2, '0');
                dateStr = `${year}${month}${day}`;
            } else {
                 console.warn("Could not get valid completion date for filename from input:", completionDateInput);
            }

            // Sanitize userName by removing characters not suitable for filenames
            const sanitizedName = userName.replace(/[\/:*?"<>|]/g, '_'); 
            filename = `测评详情及分析-${sanitizedName}-${dateStr}.pdf`;
        } catch (e) {
            console.error("Error generating filename from assessment data:", e);
            // Fallback to default filename if error occurs
            filename = '测评详情及分析.pdf';
        }
        
        console.log(`Saving PDF as: ${filename}`);
        pdf.save(filename);
        console.log("PDF save initiated.");

    } catch (error) {
        console.error("导出 PDF 失败:", error);
        alert(`导出失败: ${error.message || '未知错误'}`);
    } finally {
         // --- 5. 清理追加的 HTML (重要!) ---
         const appendedAnalysis = contentElement.querySelector('.analysis-report-for-pdf'); // Needs a class added to the analysis container
         if (appendedAnalysis) {
             // console.log("Removing appended analysis HTML from modal content...");
             // contentElement.removeChild(appendedAnalysis);
             // Or simply reload the original content if viewDetail can be recalled easily?
             // Simplest: Just don't remove, the modal will be re-rendered next time anyway.
         }
         
         if (exportButton) {
             exportButton.disabled = false; 
             exportButton.innerHTML = originalButtonText; 
         } 
         console.log("Export process finished.");
    }
}

// **** 修改：viewDetail 以存储 assessmentId ****
async function viewDetail(assessmentId) {
    const detailModalBody = document.getElementById('detailModalBody');
    // **** 新增: 存储 assessmentId 到 modal body 的 dataset ****
    detailModalBody.dataset.assessmentId = assessmentId;
    
    detailModalBody.innerHTML = '<div id="detailModalContentToExport"><p class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 加载详情中...</p></div>';
    
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
        // **** 新增：包含 UserProfile 关联的指针 ****
        query.include('userPointer.positionPointer');
        query.include('userPointer.stationPointer');
        const assessment = await query.get(assessmentId);

        // 查询关联的 AssessmentDetail
        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', assessment);
        detailQuery.limit(1000); // Assume max 1000 questions per assessment
        const details = await detailQuery.find();

        // 构建详情 HTML
        let htmlContent = buildDetailHtml(assessment, details);
        // **** 修改: 将内容放入带有 ID 的 div 中 ****
        detailModalBody.innerHTML = `<div id="detailModalContentToExport">${htmlContent}</div>`;

    } catch (error) {
        console.error("加载详情失败:", error);
        // **** 修改: 错误信息也放入带有 ID 的 div 中 ****
        detailModalBody.innerHTML = `<div id="detailModalContentToExport"><p class="text-danger text-center">加载详情失败: ${error.message || '未知错误'}</p></div>`;
    }
}

// **** ------------------------------------------ ****
// **** START: Functions copied/adapted from analysis.js for PDF export ****
// **** ------------------------------------------ ****

// Calculates performance per section for a single assessment record
function calculateIndividualSectionPerformance(record) {
    if (!record || !record.questions || !record.answers) {
        console.warn("[calculateIndividualSectionPerformance] Invalid record data provided.");
        return { sections: {}, totalAchieved: 0, totalPossible: 0 };
    }

    const sections = {};
    let totalAchieved = 0;
    let totalPossible = 0;

    record.questions.forEach(question => {
        const section = question.section || '未分类'; // Default section if missing
        const answer = record.answers[question.id];
        const score = answer ? (answer.score ?? 0) : 0;
        const standardScore = question.standardScore ?? 0;

        if (!sections[section]) {
            sections[section] = { achieved: 0, possible: 0, count: 0 };
        }

        sections[section].achieved += score;
        sections[section].possible += standardScore;
        sections[section].count++;
        totalAchieved += score;
        totalPossible += standardScore;
    });

    // Calculate mastery rate for each section
    for (const sectionName in sections) {
        const sectionData = sections[sectionName];
        sectionData.masteryRate = sectionData.possible > 0
            ? parseFloat(((sectionData.achieved / sectionData.possible) * 100).toFixed(1))
            : 0;
    }
    
    // Sort sections alphabetically for consistent display
    const sortedSections = Object.entries(sections)
                             .sort(([,a], [,b]) => a.sectionName?.localeCompare(b.sectionName || ''))
                             .reduce((obj, [key, value]) => {
                                 obj[key] = value;
                                 return obj;
                             }, {});


    return {
        sections: sortedSections, // Use sorted sections
        totalAchieved: totalAchieved,
        totalPossible: totalPossible,
        overallMasteryRate: totalPossible > 0 
            ? parseFloat(((totalAchieved / totalPossible) * 100).toFixed(1))
            : 0
    };
}

// Calculates best/worst questions for a single record
function calculateIndividualQuestionPerformance(record) {
    if (!record || !record.questions || !record.answers) {
        console.warn("[calculateIndividualQuestionPerformance] Invalid record data provided.");
        return { best: [], worst: [], other: [] };
    }

    const questions = record.questions.map(q => {
        const answer = record.answers[q.id];
        const score = answer ? (answer.score ?? null) : null;
        const standardScore = q.standardScore ?? 0;
        const scoreRate = (standardScore > 0 && score !== null) 
                          ? parseFloat(((score / standardScore) * 100).toFixed(1)) 
                          : (score === null ? null : 0); // Rate is null if not scored
        return {
            id: q.id,
            content: q.content,
            score: score,
            standardScore: standardScore,
            scoreRate: scoreRate,
            section: q.section || '未分类',
            comment: answer?.comment || ''
        };
    }).filter(q => q.score !== null); // Only consider scored questions

    const calculateRate = (q) => {
         if (q.score === null || q.score === undefined) return -1; // Treat unscored as lowest
         return q.standardScore > 0 ? (q.score / q.standardScore) : 0;
    };
    
    questions.sort((a, b) => calculateRate(b) - calculateRate(a)); // Sort descending by rate

    const threshold = 60; // **** 修改：阈值改为 60 **** // Example threshold for "well mastered"
    const best = questions.filter(q => q.scoreRate !== null && q.scoreRate >= threshold);
    const worst = questions.filter(q => q.scoreRate !== null && q.scoreRate < threshold);

    return {
        best: best,
        worst: worst,
        other: [] // We are not using 'other' category here
    };
}

// Generates training suggestions based on a single record
function generateIndividualTrainingSuggestions(record) {
     if (!record || !record.questions || !record.answers) {
        console.warn("[generateIndividualTrainingSuggestions] Invalid record data provided.");
        return { sectionSuggestions: [], questionSuggestions: [], overallSuggestion: '' };
    }

    const performance = calculateIndividualSectionPerformance(record);
    const questionPerformance = calculateIndividualQuestionPerformance(record);
    const lowScoreThresholdRate = 60; // Score rate below 60% is considered weak
    const suggestions = {
        sectionSuggestions: [], // Suggestions based on weak sections
        questionSuggestions: [], // Suggestions based on specific weak questions
        overallSuggestion: '' // Overall assessment comment
    };

    // 1. Section-based Suggestions
    const weakSections = Object.entries(performance.sections)
                               .filter(([_, data]) => data.masteryRate < lowScoreThresholdRate)
                               .sort(([,a], [,b]) => a.masteryRate - b.masteryRate); // Sort weakest first

    weakSections.forEach(([sectionName, data]) => {
        suggestions.sectionSuggestions.push(
            `<strong>重点关注板块：</strong> ${sectionName} (${data.masteryRate.toFixed(1)}%)，掌握程度严重不足，建议安排<strong class="text-danger">系统性培训和专项辅导</strong>。`
        );
    });

    // 2. Question-based Suggestions (focus on worst performing)
    const weakQuestions = questionPerformance.worst
                                .filter(q => q.scoreRate !== null && q.scoreRate < lowScoreThresholdRate)
                                .sort((a, b) => a.scoreRate - b.scoreRate); // Sort worst first

    if (weakQuestions.length > 0) {
         let questionListHtml = '<ul class="list-unstyled mb-0">';
         weakQuestions.slice(0, 5).forEach(q => { // Limit to top 5 worst
             questionListHtml += `<li>${q.content} <span class="badge bg-danger">${q.score}/${q.standardScore}</span></li>`;
         });
         questionListHtml += '</ul>';
         suggestions.questionSuggestions.push(
             `<strong>掌握薄弱题目：</strong> 以下题目得分低于 60% 或未作答，请重点关注：${questionListHtml} 建议<strong class="text-danger">查找相关资料重点复习</strong>。`
         );
    }

    // 3. Overall Suggestion
    const overallRate = performance.overallMasteryRate;
    if (overallRate < 60) {
        suggestions.overallSuggestion = `<strong>总体评价：</strong> 本次测评成绩 (${overallRate.toFixed(1)}%) <strong class="text-danger">偏低</strong>，基础知识和核心技能掌握不足。`;
    } else if (overallRate < 85) {
        suggestions.overallSuggestion = `<strong>总体评价：</strong> 本次测评成绩 (${overallRate.toFixed(1)}%) 良好，但仍有提升空间，部分知识点掌握不够牢固。`;
    } else {
        suggestions.overallSuggestion = `<strong>总体评价：</strong> 本次测评成绩 (${overallRate.toFixed(1)}%) 优秀，基础知识和核心技能掌握较好。`;
    }
    
    // 4. General Learning Suggestion
    suggestions.learningSuggestion = `<strong>学习建议：</strong> 必须<strong class="text-danger">必须系统复习</strong>，对照教材/手册，逐一攻克薄弱点，多向同事或师傅请教，增加实操练习。`;

    return suggestions;
}

// **** 新增：构建分析报告的 HTML (用于 PDF) ****
function buildAnalysisHtmlForPdf(record) {
     if (!record) return '';

    const threshold = 60; // **** 新增：在这里定义阈值，使其在函数内可用 ****

    const sectionPerformance = calculateIndividualSectionPerformance(record);
    const questionPerformance = calculateIndividualQuestionPerformance(record);
    const suggestions = generateIndividualTrainingSuggestions(record);

    // --- 1. 模块得分分布 (模拟 analysis.html 的卡片结构) ---
    let sectionHtml = '';
    // **** 添加 analysis-report-card 类用于 CSS 控制分页 ****
    sectionHtml += '<div class="card analysis-report-card shadow-sm mb-4">'; 
    // **** 添加 text-dark 提高对比度 ****
    sectionHtml += '  <div class="card-header bg-light fw-bold text-dark"><i class="bi bi-pie-chart-fill me-2"></i>模块得分分布</div>'; 
    sectionHtml += '  <div class="card-body">';
    sectionHtml += '    <div class="row text-center g-3">'; // Use grid gap
    const sectionEntries = Object.entries(sectionPerformance.sections);
    if (sectionEntries.length > 0) {
        sectionEntries.forEach(([sectionName, data]) => {
            const colorClass = data.masteryRate >= 85 ? 'text-success' : (data.masteryRate >= 60 ? 'text-warning' : 'text-danger');
            sectionHtml += `
                <div class="col-md-4 col-sm-6">
                    <div class="border rounded p-2 h-100 d-flex flex-column justify-content-center align-items-center">
                        <h6 class="mb-1 text-primary">${sectionName}</h6>
                        <p class="mb-0 small">得分: ${data.achieved} / ${data.possible}</p>
                        <p class="fw-bold ${colorClass} mb-0">掌握率: ${data.masteryRate.toFixed(1)}%</p>
                    </div>
                </div>`;
        });
    } else {
        sectionHtml += '<p class="text-muted">无模块得分数据。</p>';
    }
    sectionHtml += '    </div>'; // end row
    sectionHtml += '  </div>'; // end card-body
    sectionHtml += '</div>'; // end card

    // **** 新增：在板块之间添加视觉分隔线 ****
    sectionHtml += '<hr class="my-3" style="border-top: 1px dashed #ccc; background-color: transparent;">'; 

    // --- 2. 题目掌握情况 --- 
    let masteryHtml = '';
    // **** 添加 analysis-report-card 类 ****
    masteryHtml += '<div class="card analysis-report-card shadow-sm mb-4">'; 
    // **** 添加 text-dark ****
    masteryHtml += '  <div class="card-header bg-light fw-bold text-dark"><i class="bi bi-list-check me-2"></i>题目掌握情况</div>'; 
    masteryHtml += '  <div class="card-body">';
    // Well Mastered Questions
    masteryHtml += `    <h6 class="text-success"><i class="bi bi-check-circle-fill me-1"></i>掌握较好题目 (得分 >= ${threshold}%)</h6>`; // Use threshold variable
    if (questionPerformance.best.length > 0) {
        masteryHtml += '    <ul class="list-group list-group-flush mb-3">';
        questionPerformance.best.forEach(q => {
            masteryHtml += `<li class="list-group-item py-1">${q.content} <span class="badge bg-success float-end">${q.score}/${q.standardScore}</span></li>`;
        });
        masteryHtml += '    </ul>';
    } else {
        masteryHtml += '    <p class="text-muted ms-3">无相关题目</p>';
    }
    // Weak Questions
    masteryHtml += `    <h6 class="text-danger mt-3"><i class="bi bi-exclamation-triangle-fill me-1"></i>待提高题目 (得分 < ${threshold}%)</h6>`; // Use threshold variable
    if (questionPerformance.worst.length > 0) {
        masteryHtml += '    <ul class="list-group list-group-flush">';
        questionPerformance.worst.forEach(q => {
            masteryHtml += `<li class="list-group-item py-1">${q.content} <span class="badge bg-danger float-end">${q.score}/${q.standardScore}</span></li>`;
        });
        masteryHtml += '    </ul>';
    } else {
        masteryHtml += '    <p class="text-muted ms-3">无相关题目</p>';
    }
    masteryHtml += '  </div>'; // end card-body
    masteryHtml += '</div>'; // end card

    // **** 新增：在板块之间添加视觉分隔线 ****
    masteryHtml += '<hr class="my-3" style="border-top: 1px dashed #ccc; background-color: transparent;">';

    // --- 3. 个人培训建议 ---
    let suggestionHtml = '';
    // **** 添加 analysis-report-card 类 ****
    suggestionHtml += '<div class="card analysis-report-card shadow-sm">'; 
    // **** 添加 text-dark ****
    suggestionHtml += '  <div class="card-header bg-light fw-bold text-dark"><i class="bi bi-person-video3 me-2"></i>个人培训建议</div>'; 
    suggestionHtml += '  <div class="card-body">';
    suggestionHtml += '    <ul class="list-group list-group-flush">';
    if (suggestions.sectionSuggestions.length > 0) {
        suggestions.sectionSuggestions.forEach(s => {
            suggestionHtml += `<li class="list-group-item"><i class="bi bi-exclamation-diamond-fill text-danger me-2"></i>${s}</li>`;
        });
    }
    if (suggestions.questionSuggestions.length > 0) {
         suggestions.questionSuggestions.forEach(s => {
            suggestionHtml += `<li class="list-group-item"><i class="bi bi-clipboard-minus text-warning me-2"></i>${s}</li>`;
        });
    }
    if (suggestions.overallSuggestion) {
        suggestionHtml += `<li class="list-group-item"><i class="bi bi-clipboard-data text-info me-2"></i>${suggestions.overallSuggestion}</li>`;
    }
     if (suggestions.learningSuggestion) {
        suggestionHtml += `<li class="list-group-item"><i class="bi bi-book text-primary me-2"></i>${suggestions.learningSuggestion}</li>`;
    }
    if (suggestions.sectionSuggestions.length === 0 && suggestions.questionSuggestions.length === 0) {
         suggestionHtml += '<li class="list-group-item text-muted">暂无具体薄弱项建议。</li>';
    }
    suggestionHtml += '    </ul>';
    suggestionHtml += '  </div>'; // end card-body
    suggestionHtml += '</div>'; // end card

    // Combine all parts with a header
    // **** 添加 analysis-report-container 类 ****
    let finalHtml = '<div class="analysis-report-container">'; // Wrap the whole report
    finalHtml += '<hr class="my-4">'; // Separator
    finalHtml += '<h5 class="mb-3 text-center text-primary"><i class="bi bi-clipboard2-pulse-fill me-2"></i>个人分析报告</h5>';
    finalHtml += sectionHtml; // Already includes its trailing HR
    finalHtml += masteryHtml; // Already includes its trailing HR
    finalHtml += suggestionHtml;
    finalHtml += '</div>'; // Close the wrapper div

    return finalHtml;
}


// **** ------------------------------------------ ****
// **** END: Functions copied/adapted from analysis.js ****
// **** ------------------------------------------ ****