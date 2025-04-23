// 全局变量，用于存储图表实例，方便更新
let sectionMasteryChartInstance = null;
let scoreDistributionChartInstance = null;
let individualSectionChartInstance = null;
let historicalScoresChartInstance = null;
// **** Add missing global variable ****
let positionSectionChartInstance = null;
let allEmployees = []; // 存储所有员工


// **** 新增：清空分析显示区域函数 ****
function clearAnalysisDisplay() {
    // 岗位分析区域
    const positionContent = document.getElementById('positionAnalysisContent');
    const positionPlaceholder = document.getElementById('positionAnalysisPlaceholder');
    if (positionContent) positionContent.style.display = 'none';
    if (positionPlaceholder) positionPlaceholder.style.display = 'block'; // 显示提示

    // 个人分析区域
    const individualContent = document.getElementById('individualAnalysisContent');
    const individualPlaceholder = document.getElementById('individualAnalysisPlaceholder');
     if (individualContent) individualContent.style.display = 'none';
     if (individualPlaceholder) individualPlaceholder.style.display = 'block'; // 显示提示

     // 销毁图表实例以清除旧数据和避免内存泄漏
     if (positionSectionChartInstance) { positionSectionChartInstance.destroy(); positionSectionChartInstance = null; }
     if (scoreDistributionChartInstance) { scoreDistributionChartInstance.destroy(); scoreDistributionChartInstance = null; }
     if (individualSectionChartInstance) { individualSectionChartInstance.destroy(); individualSectionChartInstance = null; }
     if (historicalScoresChartInstance) { historicalScoresChartInstance.destroy(); historicalScoresChartInstance = null; }

     // 清空列表内容 (可选, 如果加载函数会覆盖的话)
    // const bestQuestionsList = document.getElementById('bestQuestionsList');
    // const worstQuestionsList = document.getElementById('worstQuestionsList');
    // const positionTrainingSuggestions = document.getElementById('positionTrainingSuggestions');
    // const individualBestQuestionsList = document.getElementById('individualBestQuestionsList');
    // const individualWorstQuestionsList = document.getElementById('individualWorstQuestionsList');
    // const individualTrainingSuggestions = document.getElementById('individualTrainingSuggestions');
    // if (bestQuestionsList) bestQuestionsList.innerHTML = '<li>加载中...</li>';
    // if (worstQuestionsList) worstQuestionsList.innerHTML = '<li>加载中...</li>';
    // if (positionTrainingSuggestions) positionTrainingSuggestions.innerHTML = '<li>加载中...</li>';
    // if (individualBestQuestionsList) individualBestQuestionsList.innerHTML = '<li>加载中...</li>';
    // if (individualWorstQuestionsList) individualWorstQuestionsList.innerHTML = '<li>加载中...</li>';
    // if (individualTrainingSuggestions) individualTrainingSuggestions.innerHTML = '<li>加载中...</li>';

    // 清空个人信息区域和下拉框状态
    const selectedInfo = document.getElementById('selectedEmployeeInfo');
    if(selectedInfo) selectedInfo.textContent = '';
    const recordSelect = document.getElementById('assessmentRecordSelect');
    if(recordSelect) {
        recordSelect.innerHTML = '<option value="">-- 选择员工后加载 --</option>';
        recordSelect.disabled = true;
    }

    console.log("Analysis display cleared.");
}
// **** 结束新增清空函数 ****

// **** 新增：加载岗位列表到下拉框 ****
function loadPositionList() {
    // // console.log("[loadPositionList] 开始加载岗位下拉列表...");
    const positionSelect = document.getElementById('positionSelect'); // 岗位分析用
    const employeePositionSelect = document.getElementById('employeePosition'); // 个人分析用

    if (!positionSelect || !employeePositionSelect) {
        console.error("[loadPositionList] 错误：找不到岗位选择下拉框元素。");
        return;
    }

    // 清空现有选项 (保留默认的 "全部岗位")
    positionSelect.innerHTML = '<option value="all">全部岗位</option>';
    employeePositionSelect.innerHTML = '<option value="all">全部岗位</option>';

    try {
        const positionsData = localStorage.getItem('jobPositions');
        if (!positionsData) {
            console.warn("[loadPositionList] localStorage 中未找到 'jobPositions' 数据。");
            // 可以选择性地禁用下拉框或显示提示
            return;
        }
        const positions = JSON.parse(positionsData);
        // // console.log("[loadPositionList] 从 localStorage 加载岗位数据:", positions);

        let positionCount = 0;
        for (const code in positions) {
            if (Object.hasOwnProperty.call(positions, code)) {
                const name = positions[code] || code; // 使用名称，如果名称为空则用代码
                const option = document.createElement('option');
                option.value = code;
                option.textContent = name;
                positionSelect.appendChild(option.cloneNode(true));
                employeePositionSelect.appendChild(option);
                positionCount++;
            }
        }
        // // console.log(`[loadPositionList] 成功添加了 ${positionCount} 个岗位选项。`);

        if (positionCount === 0) {
            console.warn("[loadPositionList] 'jobPositions' 数据为空，下拉框内容为空。");
        }
    } catch (error) {
        console.error("[loadPositionList] 加载或解析 'jobPositions' 出错:", error);
        // 可以选择性地禁用下拉框或显示错误消息
    }
    // // console.log("[loadPositionList] 岗位下拉列表加载完成。");
}
// **** 结束新增函数 ****

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化岗位分析日期范围为当前月份
    // const today = new Date();
    // const currentMonth = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2);
    // const positionDateRangeInput = document.getElementById('positionDateRange');
    // if (positionDateRangeInput) {
    //     positionDateRangeInput.value = currentMonth;
    //     positionDateRangeInput.max = currentMonth; // 防止选择未来月份
    // }

    // 初始化个人分析的员工下拉列表
    // const employeeSelect = document.getElementById('employeeSelect');

    // **** 新增：检查 URL 参数并自动加载分析 ****
    const urlParams = new URLSearchParams(window.location.search);
    const employeeIdParam = urlParams.get('employeeId');
    const assessmentIdParam = urlParams.get('assessmentId');
    const tabParam = urlParams.get('tab');

    if (tabParam === 'individual' && employeeIdParam && assessmentIdParam) {
        // // console.log("URL params detected, loading individual analysis...");
        // 切换到个人分析标签页
        const individualTab = document.getElementById('individual-tab');
        const positionTab = document.getElementById('position-tab');
        if (individualTab && positionTab) {
            // 使用 Bootstrap 的 Tab API 来切换
            const tab = new bootstrap.Tab(individualTab);
            tab.show();
        }
        
        // 加载员工列表，并预选指定员工
        loadEmployeeListAndSelect(employeeIdParam, assessmentIdParam);

    } else {
        // 默认行为：如果 URL 没有指定，加载岗位分析或员工列表
        const activeTab = document.querySelector('#analysisTabs .nav-link.active');
        if(activeTab && activeTab.id === 'position-tab') {
            loadPositionAnalysis();
        }
        // 初始加载员工列表（用于手动选择）
        loadEmployeeList();
    }

    // **** 在监听器顶部获取所有需要的按钮引用 ****
    const positionTab = document.getElementById('position-tab');
    const individualTab = document.getElementById('individual-tab');
    const exportQuestionBankBtn = document.getElementById('exportQuestionBankBtn');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    const exportPausedBtn = document.getElementById('exportPausedBtn');
    const importBtn = document.getElementById('importDataBtn');
    const fileInput = document.getElementById('importFileInput');

    // 绑定标签页切换事件
    if (positionTab) {
        positionTab.addEventListener('shown.bs.tab', function () {
            loadPositionAnalysis();
        });
    }
    if (individualTab) {
         individualTab.addEventListener('shown.bs.tab', function () {
             if (!allEmployees || allEmployees.length === 0) { 
                loadEmployeeList(); 
             }
         });
    }

    clearAnalysisDisplay(); 
    loadPositionList();
    loadEmployeeList();

    // **** 绑定导出/导入按钮事件 ****
    if (exportQuestionBankBtn) {
        exportQuestionBankBtn.addEventListener('click', exportQuestionBank);
    }
    if (exportHistoryBtn) {
        exportHistoryBtn.addEventListener('click', exportCompletedHistory);
    }
    if (exportPausedBtn) {
        exportPausedBtn.addEventListener('click', exportPausedAssessments);
    }
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click()); 
        fileInput.addEventListener('change', handleFileImport);
    }
});

// --- 岗位分析 ---

function clearPositionAnalysis() {
     document.getElementById('positionAnalysisContent').style.display = 'none';
     document.getElementById('positionAnalysisPlaceholder').style.display = 'block';
     // 可以选择性地销毁旧图表
     if (sectionMasteryChartInstance) sectionMasteryChartInstance.destroy();
     if (scoreDistributionChartInstance) scoreDistributionChartInstance.destroy();
     document.getElementById('bestQuestionsList').innerHTML = '<li>加载中...</li>';
     document.getElementById('worstQuestionsList').innerHTML = '<li>加载中...</li>';
     document.getElementById('positionTrainingSuggestions').innerHTML = '<li>加载中...</li>';
}

// **** 重构：从云端加载岗位分析数据 ****
async function loadPositionAnalysis() {
    console.log("[loadPositionAnalysis] 开始从云端加载岗位分析数据...");
    const positionSelect = document.getElementById('positionSelect');
    const startDateInput = document.getElementById('positionStartDate');
    const endDateInput = document.getElementById('positionEndDate');
    const contentDiv = document.getElementById('positionAnalysisContent');
    const placeholderDiv = document.getElementById('positionAnalysisPlaceholder');

    // 显示加载状态
    clearPositionAnalysis(); // 清空旧内容
    placeholderDiv.innerHTML = '<p class="text-muted text-center mt-3"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>正在加载分析数据...</p>';
    placeholderDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    const selectedPosition = positionSelect ? positionSelect.value : 'all';
    const startDateValue = startDateInput ? startDateInput.value : null;
    const endDateValue = endDateInput ? endDateInput.value : null;

    console.log(`[loadPositionAnalysis] 筛选条件: 岗位='${selectedPosition}', 开始日期='${startDateValue}', 结束日期='${endDateValue}'`);

    try {
        // 1. 构建基础查询
        const assessmentQuery = new AV.Query('Assessment');
        assessmentQuery.limit(1000); // 限制数量，可能需要分页
        assessmentQuery.include('userPointer'); // 可能需要用户信息

        // 2. 应用筛选条件
        if (selectedPosition !== 'all') {
            assessmentQuery.equalTo('positionCode', selectedPosition);
        }
        if (startDateValue) {
            // LeanCloud 日期查询通常使用 ISO 格式 Date 对象
            assessmentQuery.greaterThanOrEqualTo('endTime', new Date(startDateValue + 'T00:00:00.000Z'));
        }
        if (endDateValue) {
            const end = new Date(endDateValue + 'T00:00:00.000Z');
            end.setDate(end.getDate() + 1); // 包含当天，查询小于次日零点
            assessmentQuery.lessThan('endTime', end);
        }

        // 3. 执行查询获取 Assessment 记录
        const filteredAssessments = await assessmentQuery.find();
        console.log(`[loadPositionAnalysis] 从云端查询到 ${filteredAssessments.length} 条符合条件的 Assessment 记录.`);

        if (filteredAssessments.length === 0) {
            placeholderDiv.innerHTML = '<p class="text-muted text-center mt-3">未找到符合所选岗位和日期范围的测评记录。</p>';
            return;
        }

        // 4. **** 获取所有相关 Assessment 的 Details (性能警告!) ****
        console.log("[loadPositionAnalysis] 开始查询关联的 AssessmentDetail 数据 (可能需要较长时间)..."); // <-- 确保引号正确
        const detailsMap = {}; // { assessmentId: [details] }
        // 使用 Promise.all 并发查询，稍微提高效率
        const detailQueries = filteredAssessments.map(assessment => {
            const detailQuery = new AV.Query('AssessmentDetail');
            detailQuery.equalTo('assessmentPointer', assessment);
            detailQuery.limit(1000); // 假设单次测评题目上限
            return detailQuery.find().then(details => {
                detailsMap[assessment.id] = details;
            });
        });
        await Promise.all(detailQueries);
        console.log(`[loadPositionAnalysis] AssessmentDetail 查询完成. 共获取了 ${Object.keys(detailsMap).length} 个 Assessment 的详情.`);
        // **** Detail 获取结束 ****

        // 5. 调用分析函数 (传入云端对象和 detailsMap)
        console.log("[loadPositionAnalysis] 开始计算分析指标...");
        
        // 5.1 分数段分布 (只需要 Assessment 数据)
        const scoreDistribution = calculateScoreDistribution(filteredAssessments);
        console.log("[loadPositionAnalysis] 分数段分布计算完成.");

        // 5.2 各板块整体掌握情况 (需要 Assessment 和 Details)
        const avgSectionRates = calculatePositionSectionMastery(filteredAssessments, detailsMap);
        console.log("[loadPositionAnalysis] 各板块掌握情况计算完成.");

        // 5.3 题目掌握情况 (需要 Assessment 和 Details)
        const overallQuestionPerformance = analyzeOverallQuestionPerformance(filteredAssessments, detailsMap);
        console.log("[loadPositionAnalysis] 题目掌握情况计算完成.");

        // 5.4 培训建议 (基于板块平均分)
        const overallSuggestions = generateOverallTrainingSuggestions(avgSectionRates);
        console.log("[loadPositionAnalysis] 培训建议生成完成.");
        
        // 6. 渲染结果
        console.log("[loadPositionAnalysis] 开始渲染分析结果...");
        renderScoreDistributionChart(scoreDistribution);
        renderPositionSectionMasteryChart(avgSectionRates);
        renderQuestionPerformanceLists(overallQuestionPerformance.best, 'bestQuestionsList', true);
        renderQuestionPerformanceLists(overallQuestionPerformance.worst, 'worstQuestionsList', true);
        renderTrainingSuggestions(overallSuggestions, 'positionTrainingSuggestions');
        console.log("[loadPositionAnalysis] 结果渲染完成.");

        // 显示内容，隐藏加载提示
        placeholderDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        console.log("[loadPositionAnalysis] 分析完成，显示结果。");

    } catch (error) {
        console.error("[loadPositionAnalysis] 加载岗位分析数据失败:", error);
        placeholderDiv.innerHTML = `<p class="text-danger text-center mt-3"><i class="bi bi-exclamation-triangle-fill me-2"></i>加载岗位分析失败: ${error.message}</p>`;
    }
}

// **** 修改：calculatePositionSectionMastery 接收 detailsMap ****
function calculatePositionSectionMastery(assessments, detailsMap) {
    console.log(`[calculatePositionSectionMastery] Calculating for ${assessments.length} assessments using detailsMap.`);
    // 直接调用 calculateAverageSectionScores，它现在需要 detailsMap
    return calculateAverageSectionScores(assessments, detailsMap);
}

// **** 删除旧的 calculateSectionMastery (不再需要) ****
// function calculateSectionMastery(records) { ... }

// **** 修改：calculateScoreDistribution 处理云端对象 ****
function calculateScoreDistribution(assessments) {
    const distribution = {
        '<60': 0,
        '60-69': 0,
        '70-79': 0,
        '80-89': 0,
        '90-100': 0
    };
    let totalRecords = 0;

    assessments.forEach(record => {
        const rate = record.get('scoreRate'); // 从云端对象获取
        if (rate !== undefined && rate !== null) { // 检查是否有效
            totalRecords++;
            if (rate < 60) distribution['<60']++;
            else if (rate < 70) distribution['60-69']++;
            else if (rate < 80) distribution['70-79']++;
            else if (rate < 90) distribution['80-89']++;
            else distribution['90-100']++;
        }
    });

     // 计算百分比 (逻辑不变)
     const distributionPercent = {};
     if (totalRecords > 0) {
         for (const range in distribution) {
             distributionPercent[range] = Math.round((distribution[range] / totalRecords) * 100);
         }
     } else {
          for (const range in distribution) {
             distributionPercent[range] = 0;
         }
     }
    return distributionPercent;
}


// **** 修改：calculateAverageSectionScores 处理云端对象和 detailsMap ****
function calculateAverageSectionScores(assessments, detailsMap) {
    console.log(`[calculateAverageSectionScores] Calculating for ${assessments.length} assessments using detailsMap.`);
    const sectionDataAggregated = {}; // { sectionName: { totalScoreRateSum: 0, recordCount: 0 } }
    let validRecordCount = 0;

    if (!assessments || assessments.length === 0) return {};

    assessments.forEach(record => {
        const details = detailsMap[record.id]; // 获取该 assessment 的 details
        if (!details || details.length === 0) {
            // console.warn(`[calculateAverageSectionScores] Assessment ${record.id} 缺少 details, 无法计算其板块得分率。`);
            return; // 跳过没有 details 的记录
        }
        validRecordCount++;
        const recordSectionPerformance = {}; // { section: { score: 0, max: 0 } }

        // 1. Calculate score and max for each section *within this record* using details
        details.forEach(detail => {
            const section = detail.get('sectionName') || '未分类';
            const score = detail.get('score');
            const standardScore = detail.get('standardScore') || 0;

            if (!recordSectionPerformance[section]) {
                recordSectionPerformance[section] = { score: 0, max: 0 };
            }
            if (standardScore > 0) {
                const currentScore = (score !== undefined && score !== null && !isNaN(score)) ? Number(score) : 0;
                recordSectionPerformance[section].score += currentScore;
                recordSectionPerformance[section].max += standardScore;
            }
        });

        // 2. Calculate score rate for each section *in this record* and aggregate for averaging
        Object.entries(recordSectionPerformance).forEach(([section, data]) => {
            const scoreRate = data.max > 0 ? (data.score / data.max) * 100 : 0;
            if (!sectionDataAggregated[section]) {
                sectionDataAggregated[section] = { totalScoreRateSum: 0, recordCount: 0 };
            }
            sectionDataAggregated[section].totalScoreRateSum += scoreRate;
            sectionDataAggregated[section].recordCount++;
        });
    });

    // 3. Calculate the final average score rate for each section
    const averageRates = {};
    Object.entries(sectionDataAggregated).forEach(([section, aggregatedData]) => {
        if (aggregatedData.recordCount > 0) {
            averageRates[section] = Math.round(aggregatedData.totalScoreRateSum / aggregatedData.recordCount);
        } else {
            averageRates[section] = 0; // Should not happen if recordCount > 0
        }
    });
    
    console.log(`[calculateAverageSectionScores] Calculated Average Rates over ${validRecordCount} valid records (with details):`, averageRates);
    return averageRates; // { sectionName: averageRate }
}

// **** 修改：analyzeOverallQuestionPerformance 处理云端对象和 detailsMap ****
function analyzeOverallQuestionPerformance(assessments, detailsMap) {
    console.log(`[analyzeOverallQuestionPerformance] Analyzing question performance for ${assessments.length} assessments using detailsMap.`);
    const questionStats = {}; // { questionId: { content: '...', section: '...', totalScore: 0, totalMaxScore: 0, appearances: 0 } }

    assessments.forEach(record => {
        const details = detailsMap[record.id];
        if (!details || details.length === 0) return; // Skip records without details

        details.forEach(detail => {
            const questionId = detail.get('questionId') || detail.id; // Use questionId if available
            if (!questionId) return; // Skip details without a question identifier
            
            if (!questionStats[questionId]) {
                questionStats[questionId] = {
                    content: detail.get('questionContent') || '无内容',
                    section: detail.get('sectionName') || '未分类',
                    totalScore: 0,
                    totalMaxScore: 0,
                    appearances: 0
                };
            }
            
            const score = detail.get('score');
            const standardScore = detail.get('standardScore') || 0;
            const currentScore = (score !== undefined && score !== null && !isNaN(score)) ? Number(score) : 0;

            // Only include questions with a standard score in the calculation
            if (standardScore > 0) {
                questionStats[questionId].totalScore += currentScore;
                questionStats[questionId].totalMaxScore += standardScore;
                questionStats[questionId].appearances++; // Increment appearances only if scored
            }
        });
    });

    // Calculate average score rate and filter out questions that never appeared with a score
    const performanceList = Object.entries(questionStats)
        .filter(([id, stats]) => stats.appearances > 0) // Ensure question appeared and was scored
        .map(([id, stats]) => ({
            id: id,
            content: stats.content,
            section: stats.section,
            avgScoreRate: (stats.totalMaxScore > 0) ? Math.round((stats.totalScore / stats.totalMaxScore) * 100) : 0,
            appearances: stats.appearances
        }));

    // Sort by average score rate (descending for best, ascending for worst)
    performanceList.sort((a, b) => b.avgScoreRate - a.avgScoreRate);

    // Get Top 3 best and worst
    const best = performanceList.slice(0, 3);
    // Corrected worst logic: sort ascending by score rate, then take top 3
    const worst = [...performanceList].sort((a, b) => a.avgScoreRate - b.avgScoreRate).slice(0, 3);
    
    console.log("[analyzeOverallQuestionPerformance] Best performing questions (overall):", best);
    console.log("[analyzeOverallQuestionPerformance] Worst performing questions (overall):", worst);
    
    return { best, worst };
}

// ... rest of the code (rendering functions should be mostly ok, but check if they need section info now) ...

// **** 修改 renderQuestionPerformanceLists 以包含板块信息 ****
function renderQuestionPerformanceLists(questions, listId, isCombined = false) {
    // console.log(`[renderQuestionPerformanceLists] START. List ID: ${listId}, isCombined: ${isCombined}. Data:`, questions);
    const listElement = document.getElementById(listId);
    if (!listElement) {
        console.error(`[renderQuestionPerformanceLists] ERROR: Cannot find list element with ID: ${listId}`);
        return;
    }
    // console.log(`[renderQuestionPerformanceLists] Found list element:`, listElement);
    listElement.innerHTML = ''; // Clear previous items

    if (!questions || questions.length === 0) {
        listElement.innerHTML = '<li class="list-group-item text-muted small">无相关题目</li>';
        // console.log(`[renderQuestionPerformanceLists] No questions to display for ${listId}.`);
        // console.log(`[renderQuestionPerformanceLists] END for ${listId}.`);
        return;
    }

    try {
        questions.forEach((q, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item small d-flex justify-content-between align-items-center';
            let text = q.content || '无内容';
            // **** 添加板块信息 ****
            const sectionText = q.section ? `(${q.section})` : ''; 
            let scoreInfo = '';
            if (isCombined) {
                scoreInfo = `<span class="badge bg-secondary rounded-pill">平均: ${q.avgScoreRate !== undefined ? q.avgScoreRate + '%' : 'N/A'} (${q.appearances || 0}次)</span>`;
            } else {
                const score = q.score !== undefined ? q.score : 'N/A';
                const standardScore = q.standardScore !== undefined ? q.standardScore : 'N/A';
                const badgeBgClass = listId.includes('Worst') ? 'bg-danger' : 'bg-success'; // Use success for best list
                scoreInfo = `<span class="badge ${badgeBgClass} rounded-pill">${score} / ${standardScore}</span>`;
            }
            // **** 更新 innerHTML 以包含板块 ****
            li.innerHTML = `<span class="flex-grow-1 me-2 text-truncate" title="${text}">${text} ${sectionText}</span> ${scoreInfo}`;
            listElement.appendChild(li);
            // console.log(`[renderQuestionPerformanceLists] Appended item ${index + 1} to ${listId}`); // Optional: log each item append
        });
        // console.log(`[renderQuestionPerformanceLists] Successfully rendered ${questions.length} items to ${listId}.`);
    } catch (error) {
        console.error(`[renderQuestionPerformanceLists] ERROR rendering list ${listId}:`, error);
    }
    // console.log(`[renderQuestionPerformanceLists] END for ${listId}.`);
}

// ... rest of the file ...

function renderSectionMasteryChart(sectionData) {
    const ctx = document.getElementById('sectionMasteryChart')?.getContext('2d');
    if (!ctx) return;

    const labels = Object.keys(sectionData);
    const data = Object.values(sectionData);

    if (sectionMasteryChartInstance) {
        sectionMasteryChartInstance.destroy(); // 销毁旧图表
    }

    sectionMasteryChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '平均得分率 (%)',
                data: data,
                backgroundColor: 'rgba(111, 66, 193, 0.6)', // 紫色
                borderColor: 'rgba(111, 66, 193, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100 // Y轴最大值100
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y}%`;
                        }
                    }
                }
            }
        }
    });
}

function renderScoreDistributionChart(distributionData) {
    const ctx = document.getElementById('scoreDistributionChart')?.getContext('2d');
     if (!ctx) return;

    const labels = Object.keys(distributionData);
    const data = Object.values(distributionData);

     if (scoreDistributionChartInstance) {
        scoreDistributionChartInstance.destroy();
    }

    scoreDistributionChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: '人员占比 (%)',
                data: data,
                backgroundColor: [
                    'rgba(220, 53, 69, 0.7)', // <60 (Danger)
                    'rgba(255, 193, 7, 0.7)',  // 60-69 (Warning)
                    'rgba(13, 202, 240, 0.7)', // 70-79 (Info)
                    'rgba(13, 110, 253, 0.7)', // 80-89 (Primary)
                    'rgba(25, 135, 84, 0.7)'   // 90-100 (Success)
                ],
                borderColor: '#fff',
                borderWidth: 1
            }]
        },
        options: {
             responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}%`;
                        }
                    }
                },
                legend: {
                    position: 'bottom', // 图例放到底部
                }
            }
        }
    });
}

function calculateQuestionPerformance(records) {
     const questionStats = {}; // { questionId: { content: '', totalScore: 0, totalMaxScore: 0, count: 0 } }

    records.forEach(record => {
        if (!record.questions || !record.answers) return;
        record.questions.forEach(q => {
             if (!q || !q.id) return;
            const answer = record.answers[q.id];
            const standardScore = q.standardScore || 0; // 需要题目有 standardScore

            if (!questionStats[q.id]) {
                questionStats[q.id] = {
                    content: q.content || '无内容',
                    totalScore: 0,
                    totalMaxScore: 0,
                    count: 0
                };
            }

             if (answer && standardScore > 0) {
                 questionStats[q.id].totalScore += (answer.score !== null ? answer.score : 0);
                 questionStats[q.id].totalMaxScore += standardScore;
                 questionStats[q.id].count += 1;
             }
        });
    });

     // 计算平均得分率并排序
     const questionPerformanceList = Object.entries(questionStats)
         .map(([id, stats]) => ({
             id: id,
             content: stats.content,
             avgScoreRate: stats.count > 0 && stats.totalMaxScore > 0 ? Math.round((stats.totalScore / stats.totalMaxScore) * 100) : 0,
             count: stats.count
         }))
         .filter(q => q.count > 0) // 只保留被测评过的题目
         .sort((a, b) => b.avgScoreRate - a.avgScoreRate); // 按得分率降序

    return {
        best: questionPerformanceList.slice(0, 3),
        worst: questionPerformanceList.slice(-3).reverse() // 取最后三个并反转，使最差的在前面
    };
}

function displayQuestionPerformance(performanceData) {
    const bestList = document.getElementById('bestQuestionsList');
    const worstList = document.getElementById('worstQuestionsList');

    if (bestList) {
        bestList.innerHTML = '';
        if (performanceData.best.length > 0) {
             performanceData.best.forEach(q => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.textContent = q.content;
                li.innerHTML += `<span class=\"badge bg-success rounded-pill\">${q.avgScoreRate}%</span>`;
                bestList.appendChild(li);
            });
        } else {
            bestList.innerHTML = '<li class=\"list-group-item\">暂无数据</li>';
        }
    }

     if (worstList) {
        worstList.innerHTML = '';
         if (performanceData.worst.length > 0) {
             performanceData.worst.forEach(q => {
                 const li = document.createElement('li');
                 li.className = 'list-group-item d-flex justify-content-between align-items-center';
                 li.textContent = q.content;
                 li.innerHTML += `<span class=\"badge bg-danger rounded-pill\">${q.avgScoreRate}%</span>`;
                 worstList.appendChild(li);
             });
         } else {
             worstList.innerHTML = '<li class=\"list-group-item\">暂无数据</li>';
         }
    }
}

function generatePositionTrainingSuggestions(sectionData, worstQuestions) {
    const suggestions = [];
    Object.entries(sectionData).forEach(([section, avgScoreRate]) => {
        let level = '';
        let icon = '';
        if (avgScoreRate < 60) {
            level = '重点关注';
            icon = '<i class=\"bi bi-exclamation-triangle-fill text-danger me-2\"></i>';
        } else if (avgScoreRate < 70) {
            level = '需要培训';
            icon = '<i class=\"bi bi-exclamation-circle-fill text-warning me-2\"></i>';
        } else {
            // level = '合格'; // 合格的不显示建议
            // icon = '<i class=\"bi bi-check-circle-fill text-success me-2\"></i>';
            return; // 如果合格则不生成建议
        }
         suggestions.push({ section, avgScoreRate, level, icon });
    });

    // 添加最差题目的培训建议
    if (worstQuestions && worstQuestions.length > 0) {
        suggestions.push({
            type: 'worst_questions',
            icon: '<i class=\"bi bi-journal-x text-danger me-2\"></i>',
            title: '薄弱题目加强培训',
            questions: worstQuestions
        });
    }

     // 按得分率升序排列，问题最严重的在前
    suggestions.sort((a, b) => {
        // 题目建议放最后
        if (a.type === 'worst_questions') return 1;
        if (b.type === 'worst_questions') return -1;
        // 其他按得分率排序
        return a.avgScoreRate - b.avgScoreRate;
    });

    return suggestions; // [{ section, avgScoreRate, level, icon }] 或 [{ type, icon, title, questions }]
}

function displayPositionTrainingSuggestions(suggestions) {
    const list = document.getElementById('positionTrainingSuggestions');
    if (!list) return;
    list.innerHTML = '';
     if (suggestions.length > 0) {
        suggestions.forEach(s => {
            if (s.type === 'worst_questions') {
                // 特殊处理题目建议
                const li = document.createElement('li');
                li.className = 'list-group-item';
                
                const header = document.createElement('div');
                header.innerHTML = `${s.icon}<strong>${s.title}</strong>`;
                header.className = 'mb-2';
                li.appendChild(header);
                
                const questionList = document.createElement('ul');
                questionList.className = 'list-unstyled small ms-4';
                s.questions.forEach(q => {
                    const qItem = document.createElement('li');
                    qItem.innerHTML = `<i class="bi bi-dot"></i> ${q.content} <span class="badge bg-danger rounded-pill">${q.avgScoreRate}%</span>`;
                    questionList.appendChild(qItem);
                });
                li.appendChild(questionList);
                
                list.appendChild(li);
            } else {
                // 正常处理板块建议
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `<span>${s.icon}<strong>${s.section}</strong> (平均 ${s.avgScoreRate}%)</span> <span class=\"badge bg-${s.level === '重点关注' ? 'danger' : 'warning'} rounded-pill\">${s.level}</span>`;
                list.appendChild(li);
            }
        });
    } else {
        list.innerHTML = '<li class=\"list-group-item\"><i class=\"bi bi-check-all me-2 text-success\"></i>所有板块均已达到合格标准 (>=70%)。</li>';
    }
}


// --- 个人分析 ---

/* **** 移除旧的 loadIndividualAnalysis 函数 ****
function loadIndividualAnalysis(assessmentId) {
    console.log(`加载测评记录 ${assessmentId} 的分析数据...`);

     // 显示内容区域，隐藏占位符
    document.getElementById('individualAnalysisContent').classList.remove('d-none');
    document.getElementById('individualAnalysisPlaceholder').classList.add('d-none');

    // 1. 从 localStorage 加载所有历史记录
    const allHistory = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');

    // 2. 找到指定的测评记录
    const targetRecord = allHistory.find(r => r.id && r.id.toString() === assessmentId.toString());

     if (!targetRecord) {
        console.error(`未找到测评记录: ${assessmentId}`);
        alert("未找到指定的测评记录数据。");
        clearIndividualAnalysis();
        return;
    }
    
    console.log("找到要分析的记录:", targetRecord);
    
    // 获取该员工的所有历史记录（用于历史对比图）
    const employeeId = targetRecord.userInfo?.id || targetRecord.userInfo?.employeeId;
    const employeeHistory = allHistory
        .filter(record => (record.userInfo?.id || record.userInfo?.employeeId) === employeeId)
        .sort((a, b) => new Date(a.timestamp || a.endTime) - new Date(b.timestamp || b.endTime)); // 按时间升序

    // 更新显示所选员工信息
    const selectedInfoEl = document.getElementById('selectedEmployeeInfo');
    if (selectedInfoEl && targetRecord.userInfo) {
        selectedInfoEl.textContent = `当前分析员工: ${targetRecord.userInfo.name} (${employeeId}) - ${formatSimpleDateTime(targetRecord.timestamp || targetRecord.endTime)}`;
    }

    // 4. 进行各项分析计算 (基于 targetRecord)
    // 4.1 个人板块掌握情况 (饼图 - 指定一次)
    const individualSectionPerf = calculateIndividualSectionPerformance(targetRecord);
    renderIndividualSectionChart(individualSectionPerf);

    // 4.2 个人题目掌握情况 (列表 - 指定一次)
    const individualQuestionPerf = calculateIndividualQuestionPerformance(targetRecord);
    displayIndividualQuestionPerformance(individualQuestionPerf);

    // 4.3 个人历史成绩对比 (折线图 - 基于 employeeHistory)
    renderHistoricalScoresChart(employeeHistory);

    // 4.4 个人培训建议 (基于 targetRecord 和 employeeHistory)
    const individualSuggestions = generateIndividualTrainingSuggestions(targetRecord, employeeHistory, individualQuestionPerf.worst);
    displayIndividualTrainingSuggestions(individualSuggestions);
}
*/

function calculateIndividualSectionPerformance(record) {
    // 返回格式: { performance: { sectionName: { score: number, max: number } }, totalAchieved: number, totalStandard: number }
    const sectionPerformance = {}; 
    let totalAchievedScore = 0;
    let totalStandardScore = 0;

    if (!record || !record.questions || !record.answers) {
        console.warn("[calculateIndividualSectionPerformance] Invalid record data.", record);
        return { performance: {}, totalAchieved: 0, totalStandard: 0 }; 
    }

    record.questions.forEach(q => {
        if (!q || !q.id || !record.answers.hasOwnProperty(q.id)) {
            console.warn(`[calculateIndividualSectionPerformance] Skipping invalid/unanswered question:`, q?.id);
            return; 
        }

        const section = q.section || '未分类';
        const answer = record.answers[q.id];
        const standardScore = (q.standardScore !== undefined && q.standardScore !== null) ? Number(q.standardScore) : 0;
        const currentScore = (answer && answer.score !== undefined && answer.score !== null && !isNaN(answer.score)) ? Number(answer.score) : 0;

        if (!sectionPerformance[section]) {
            sectionPerformance[section] = { score: 0, max: 0 };
        }
        
        if (standardScore > 0) { 
            sectionPerformance[section].score += currentScore;
            sectionPerformance[section].max += standardScore;
            totalAchievedScore += currentScore;
            totalStandardScore += standardScore;
        }
    });
    
    console.log("[calculateIndividualSectionPerformance] Calculated performance:", sectionPerformance, `Total: ${totalAchievedScore}/${totalStandardScore}`);

    return { 
        performance: sectionPerformance, 
        totalAchieved: totalAchievedScore,
        totalStandard: totalStandardScore
    };
}


function renderIndividualSectionChart(performanceData, chartTitle = '板块得分分布') {
    const ctx = document.getElementById('individualSectionChart')?.getContext('2d');
    if (!ctx) {
        console.error('[renderIndividualSectionChart] ERROR: Cannot get context');
        return;
    }

    // 从传入的对象中解构数据
    const { performance = {}, totalAchieved = 0, totalStandard = 0 } = performanceData || {};

    // **** Restructure the condition check again to avoid potential linter issues ****
    let hasValidData = true;
    if (!performance || Object.keys(performance).length === 0) {
        hasValidData = false;
    }
    if (totalStandard === 0) {
         hasValidData = false;
    }

    if (!hasValidData) {
        // **** Fix SyntaxError: Use double quotes for inner string ****
        console.warn('[renderIndividualSectionChart] No valid data. Rendering "No data".'); 
        if (individualSectionChartInstance) individualSectionChartInstance.destroy();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6c757d'; 
        ctx.fillText('无板块得分数据', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const labels = Object.keys(performance); 
    const dataValues = Object.values(performance).map(p => p.score); 
    
    const unscoredValue = Math.max(0, totalStandard - totalAchieved); 
    
    if (unscoredValue > 0.01) { 
         labels.push('未得分');
         dataValues.push(unscoredValue);
    }

    const backgroundColors = [
        'rgba(111, 66, 193, 0.7)', 'rgba(25, 135, 84, 0.7)', 'rgba(13, 202, 240, 0.7)',
        'rgba(255, 193, 7, 0.7)', 'rgba(220, 53, 69, 0.7)', 'rgba(108, 117, 125, 0.7)',
        'rgba(224, 224, 224, 0.7)' 
    ];

    const finalBackgroundColors = labels.map((label, index) => {
        if (label === '未得分') {
            return backgroundColors[backgroundColors.length - 1]; 
        }
        return backgroundColors[index % (backgroundColors.length - 1)]; 
    });

    if (individualSectionChartInstance) {
        // // console.log('[renderIndividualSectionChart] Destroying previous chart instance.'); // Simplified log
        individualSectionChartInstance.destroy();
    }

    try {
        individualSectionChartInstance = new Chart(ctx, {
            type: 'doughnut', 
            data: {
                labels: labels,
                datasets: [{
                    label: '得分', 
                    data: dataValues,
                    backgroundColor: finalBackgroundColors, 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${chartTitle} (总分: ${totalStandard})`, 
                        padding: { top: 10, bottom: 10 },
                        font: { size: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}`; 
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
        // // console.log('[renderIndividualSectionChart] New chart instance created.'); // Simplified log
    } catch (error) {
        console.error('[renderIndividualSectionChart] ERROR creating chart:', error);
    }
    // // console.log('[renderIndividualSectionChart] END.'); // Simplified log
}


function calculateIndividualQuestionPerformance(record) {
    const performance = { best: [], worst: [] };
     if (!record || !record.questions || !record.answers) return performance;

     record.questions.forEach(q => {
         if (!q || !q.id) return;
         const answer = record.answers[q.id];
         const standardScore = q.standardScore || 0; // 需要 standardScore
         const knowledgeSource = q.knowledgeSource || null; // 获取知识点来源

         // **** 修改：包含 id 和 knowledgeSource, 初始化 score 为 null ****
             const questionInfo = {
              id: q.id, // 添加 ID
                 content: q.content || '无内容',
              score: null, // 初始化为 null, 表示未作答或无效
                 standardScore: standardScore,
              comment: '', // 默认空备注
              knowledgeSource: knowledgeSource // 添加来源
          };

         if (answer) { // 如果有答案记录
             // 确保 answer.score 是有效数字才赋值，否则保持 null
             if (answer.score !== null && !isNaN(answer.score)) {
                 questionInfo.score = Number(answer.score);
             }
             questionInfo.comment = answer.comment || '';

             // **** 新的判断逻辑 ****
             if (standardScore > 0) {
                 if (questionInfo.score !== null) { // 必须有有效得分才能计算比率
                     const scoreRate = (questionInfo.score / standardScore) * 100;
                     if (scoreRate < 60) { // 低于 60% 的放入待提高
                         performance.worst.push(questionInfo);
                     } else { // 大于等于 60% 的放入掌握较好
                 performance.best.push(questionInfo);
                     }
                 } else { // 分数无效或为 null (可能发生在导入或旧数据)，归为待提高
                 performance.worst.push(questionInfo);
             }
             } else { // 标准分为0或无效，归为待提高
                 performance.worst.push(questionInfo);
             }
         } else {
             // 没有答案记录 (answer 不存在), 归为待提高
             questionInfo.score = '未作答'; // 明确标记状态
             performance.worst.push(questionInfo);
         }
     });

     // 按得分率排序（将'未作答'视为最低分）
     const calculateRate = (q) => {
         if (q.score === '未作答' || q.score === null) return -1; // 未作答或无效分数视为最低
         return q.standardScore > 0 ? (q.score / q.standardScore * 100) : 0;
     };
      performance.best.sort((a, b) => calculateRate(b) - calculateRate(a)); // 高分在前
      performance.worst.sort((a, b) => calculateRate(a) - calculateRate(b)); // 低分在前

    return performance;
}


function displayIndividualQuestionPerformance(performanceData) {
    const bestList = document.getElementById('individualBestQuestionsList');
    const worstList = document.getElementById('individualWorstQuestionsList');

    if (!bestList || !worstList) return;

    bestList.innerHTML = '';
    worstList.innerHTML = '';

    if (performanceData.best && performanceData.best.length > 0) {
        performanceData.best.forEach(q => {
            const scoreInfo = q.avgScoreRate !== undefined ? `(平均: ${q.avgScoreRate}%)` : (q.score !== undefined ? `(得分: ${q.score}/${q.standardScore})` : '');
            bestList.innerHTML += `<li class="list-group-item">${q.content} ${scoreInfo}</li>`;
        });
    } else {
        bestList.innerHTML = '<li class="list-group-item text-muted">无明显掌握较好题目</li>';
    }

    if (performanceData.worst && performanceData.worst.length > 0) {
        performanceData.worst.forEach(q => {
             const scoreInfo = q.avgScoreRate !== undefined ? `(平均: ${q.avgScoreRate}%)` : (q.score !== undefined ? `(得分: ${q.score}/${q.standardScore})` : '');
            worstList.innerHTML += `<li class="list-group-item">${q.content} ${scoreInfo}</li>`;
        });
    } else {
        worstList.innerHTML = '<li class="list-group-item text-muted">无明显待提高题目</li>';
    }
}


function renderHistoricalScoresChart(historyData) {
    // // console.log('[renderHistoricalScoresChart] START. Data:', historyData);
    const ctx = document.getElementById('historicalScoresChart')?.getContext('2d');
     if (!ctx) {
        console.error('[renderHistoricalScoresChart] ERROR: Cannot get context for historicalScoresChart');
        return;
    }
    // // console.log('[renderHistoricalScoresChart] Got canvas context.');

    if (!historyData || historyData.length === 0) {
        // // console.warn('[renderHistoricalScoresChart] No history data to render.');
         if (historicalScoresChartInstance) historicalScoresChartInstance.destroy();
         // Optionally display a message on the canvas or in the card
        // // console.log('[renderHistoricalScoresChart] END (no data).');
        return;
    }

    const labels = historyData.map(record => formatSimpleDateTime(record.timestamp)); // Use simplified format
    const data = historyData.map(record => record.scoreRate || 0);

     if (historicalScoresChartInstance) {
        // // console.log('[renderHistoricalScoresChart] Destroying previous chart instance.');
        historicalScoresChartInstance.destroy();
    }

    try {
        historicalScoresChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '历史得分率 (%)',
                    data: data,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 scales: {
                     y: {
                         beginAtZero: true,
                         max: 100
                     }
                 },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `得分率: ${context.parsed.y}%`;
                            }
                        }
                    }
                }
            }
        });
        // // console.log('[renderHistoricalScoresChart] New chart instance created.');
    } catch(error) {
         console.error('[renderHistoricalScoresChart] ERROR creating chart:', error);
    }
    // // console.log('[renderHistoricalScoresChart] END.');
}

// **** 重构：生成个人培训建议 (V2) ****
function generateIndividualTrainingSuggestions(record, relevantHistory = []) { 
    // // console.log(`[generateIndividualTrainingSuggestions] START. Received record ID: ${record ? record.id : 'N/A'}, relevantHistory count: ${relevantHistory.length}`);
    
    // **** 在函数开头添加日志 ****
    // // console.log("--- generateIndividualTrainingSuggestions ---");
    const weakQuestions = record.questions ? JSON.parse(JSON.stringify(record.questions.filter(q => {
        const answer = record.answers[q.id];
        return answer && answer.score !== null && q.standardScore > 0 && (answer.score / q.standardScore) * 100 < 70;
    }))) : [];
    const improvableQuestions = record.questions ? JSON.parse(JSON.stringify(record.questions.filter(q => {
        const answer = record.answers[q.id];
        return answer && answer.score !== null && q.standardScore > 0 && (answer.score / q.standardScore) * 100 >= 70 && (answer.score / q.standardScore) * 100 < 85;
    }))) : [];
    // // console.log("Calculated weakQuestions:", weakQuestions); 
    // // console.log("Calculated improvableQuestions:", improvableQuestions);
    // **** 日志结束 ****

    const suggestions = [];
    // **** Add Try-Catch block for robustness ****
    try {
        // 定义得分率阈值
        const criticalThreshold = 60; // 非常薄弱，需重点关注
        const weakThreshold = 70;     // 有待提高 (从 75 修改为 70)
        const goodThreshold = 90;      // 良好

        // --- 0. 数据有效性检查 ---
        if (!record || !record.questions || !record.answers) {
            console.warn("[generateIndividualTrainingSuggestions V2] Invalid record data provided. Returning error suggestion.");
            // Return error suggestion array
            return [{ type: 'error', text: '无法生成培训建议：测评记录数据不完整或格式错误。', icon: 'bi-x-octagon-fill text-danger', priority: -1 }];
        }
        // // console.log("[generateIndividualTrainingSuggestions V2] Data validation passed.");

        // --- 1. 计算核心指标 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 1: Calculating core metrics...");
        const sectionPerformance = calculateIndividualSectionPerformance(record);
        const sectionScoreRates = {}; // { sectionName: scoreRate }
        if (sectionPerformance.performance) {
            Object.entries(sectionPerformance.performance).forEach(([section, data]) => {
              sectionScoreRates[section] = data.max > 0 ? Math.round((data.score / data.max) * 100) : 0;
         });
     }
        const overallScoreRate = sectionPerformance.totalStandard > 0
            ? Math.round((sectionPerformance.totalAchieved / sectionPerformance.totalStandard) * 100)
            : 0;
        const questionPerformance = calculateIndividualQuestionPerformance(record); // { best: [], worst: [] }
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 1 DONE. Overall Rate:", overallScoreRate, "Section Rates:", sectionScoreRates);

        // --- 2. 分析历史趋势 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 2: Analyzing trend...");
        let trendSuggestion = null;
        const currentRecordIndex = relevantHistory.findIndex(r => r.id === record.id);
        if (currentRecordIndex > 0) {
            const currentScoreRate = record.score?.scoreRate;
            const previousRecord = relevantHistory[currentRecordIndex - 1];
            const previousScoreRate = previousRecord?.score?.scoreRate;
            if (currentScoreRate !== undefined && previousScoreRate !== undefined) {
                const difference = currentScoreRate - previousScoreRate;
                if (difference < -10) { // 显著下降
                    trendSuggestion = {
                        type: 'trend_critical_down',
                        text: `成绩趋势：本次 (${currentScoreRate}%) 较上次 (${previousScoreRate}%) <strong class="text-danger">显著下降</strong>，需高度重视，分析原因并加强学习。`,
                        icon: 'bi-graph-down-arrow text-danger', priority: 0
                    };
                } else if (difference < -3) { // 轻微下降
                    trendSuggestion = {
                        type: 'trend_slight_down',
                        text: `成绩趋势：本次 (${currentScoreRate}%) 较上次 (${previousScoreRate}%) <strong class="text-warning">有所下降</strong>，请注意保持学习状态。`,
                        icon: 'bi-arrow-down-right text-warning', priority: 3
                    };
                } else if (difference > 10) { // 显著提升
                     trendSuggestion = {
                         type: 'trend_up',
                         text: `成绩趋势：本次 (${currentScoreRate}%) 较上次 (${previousScoreRate}%) <strong class="text-success">显著提升</strong>，值得肯定，请继续保持！`,
                         icon: 'bi-graph-up-arrow text-success', priority: 4
                     };
                } else if (difference > 3) { // 轻微提升
                     trendSuggestion = {
                         type: 'trend_slight_up',
                         text: `成绩趋势：本次 (${currentScoreRate}%) 较上次 (${previousScoreRate}%) <strong class="text-success">有所进步</strong>，继续努力！`,
                         icon: 'bi-arrow-up-right text-success', priority: 5
                     };
                } else { // 成绩稳定
                     trendSuggestion = {
                         type: 'trend_stable',
                         text: `成绩趋势：与上次 (${previousScoreRate}%)相比，本次 (${currentScoreRate}%) 成绩保持稳定。`,
                         icon: 'bi-dash-lg text-secondary', priority: 5
                     };
                }
                if (trendSuggestion) {
                    suggestions.push(trendSuggestion);
                    // // console.log("[generateIndividualTrainingSuggestions V2]   -> Trend suggestion added:", trendSuggestion.type);
                } else {
                    // // console.log("[generateIndividualTrainingSuggestions V2]   -> No specific trend detected.");
                }
            }
        } else {
             // // console.log("[generateIndividualTrainingSuggestions V2]   -> Not enough history for trend analysis (current index <= 0).");
        }
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 2 DONE. Current suggestions count:", suggestions.length);

        // --- 3. 分析板块表现 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 3: Analyzing section performance...");
        let hasCriticalSection = false;
        let hasWeakSection = false;
        Object.entries(sectionScoreRates).sort(([, rateA], [, rateB]) => rateA - rateB).forEach(([section, scoreRate]) => {
            if (scoreRate < criticalThreshold) {
                hasCriticalSection = true;
              suggestions.push({
                    type: 'section_critical',
                    text: `<strong>重点关注板块：</strong> <strong class="text-danger">${section}</strong> (${scoreRate}%)，掌握程度严重不足，建议安排<strong class="text-danger">系统性培训和专项辅导</strong>。`,
                    icon: 'bi-exclamation-triangle-fill text-danger', priority: 1
                });
                 // // console.log(`[generateIndividualTrainingSuggestions V2]   -> Critical section suggestion added for: ${section}`);
            } else if (scoreRate < weakThreshold) {
                hasWeakSection = true;
                suggestions.push({
                    type: 'section_weak',
                    text: `<strong>待加强板块：</strong> <strong class="text-warning">${section}</strong> (${scoreRate}%)，掌握尚有不足，建议<strong class="text-warning">加强复习和针对性练习</strong>。`,
                    icon: 'bi-exclamation-circle-fill text-warning', priority: 2
                });
                 // // console.log(`[generateIndividualTrainingSuggestions V2]   -> Weak section suggestion added for: ${section}`);
            }
        });
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 3 DONE. Current suggestions count:", suggestions.length);

        // --- 4. 分析具体题目表现 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 4: Analyzing question performance...");
        const criticalQuestions = questionPerformance.worst.filter(q => q.score === '未作答' || (q.standardScore > 0 && (q.score / q.standardScore * 100) < criticalThreshold));
        const weakQuestions = questionPerformance.worst.filter(q => !criticalQuestions.includes(q) && q.score !== '未作答' && q.standardScore > 0 && (q.score / q.standardScore * 100) < weakThreshold);

        if (criticalQuestions.length > 0) {
            let questionListHTML = criticalQuestions.slice(0, 3).map(q => { // 最多显示3个
                const scoreText = q.score === '未作答' ? '<span class="badge bg-danger">未作答</span>' : `<span class="badge bg-danger">${q.score}/${q.standardScore}</span>`;
                // **** 新增日志：检查 knowledgeSource ****
                console.log(`[Suggestion Gen] Critical Q: "${q.content?.substring(0, 30)}..." knowledgeSource:`, q.knowledgeSource);
                const sourceText = q.knowledgeSource 
                                   ? `，建议<strong class="text-danger">重点复习《${q.knowledgeSource}》</strong>相关内容` 
                                   : '，建议<strong class="text-danger">查找相关资料重点复习</strong>';
                return `<li class="mb-1">${q.content || '无内容'} ${scoreText}${sourceText}</li>`;
            }).join('');
        suggestions.push({
                type: 'questions_critical',
                // **** 修改：更新建议文本主体 ****
                text: `<strong>掌握薄弱题目：</strong>以下题目得分低于 ${criticalThreshold}% 或未作答，请<strong class="text-danger">重点关注</strong>：<ul class="list-unstyled small ms-3 mt-1">${questionListHTML}</ul>`,
                icon: 'bi-journal-x text-danger', priority: 1
            });
            // // console.log("[generateIndividualTrainingSuggestions V2]   -> Critical questions suggestion added.");
        } else if (weakQuestions.length > 0) {
            let questionListHTML = weakQuestions.slice(0, 3).map(q => {
                const scoreText = `<span class="badge bg-warning">${q.score}/${q.standardScore}</span>`;
                 // **** 新增日志：检查 knowledgeSource ****
                 console.log(`[Suggestion Gen] Weak Q: "${q.content?.substring(0, 30)}..." knowledgeSource:`, q.knowledgeSource);
                 const sourceText = q.knowledgeSource 
                                   ? `，建议<strong class="text-warning">参考《${q.knowledgeSource}》加深理解</strong>` 
                                   : '，建议<strong class="text-warning">对照标准答案加深理解</strong>';
                return `<li class="mb-1">${q.content || '无内容'} ${scoreText}${sourceText}</li>`;
            }).join('');
            suggestions.push({
                type: 'questions_weak',
                 // **** 修改：更新建议文本主体 ****
                text: `<strong>待改进题目：</strong>以下题目得分介于 ${criticalThreshold}%-${weakThreshold}%，有提升空间：<ul class="list-unstyled small ms-3 mt-1">${questionListHTML}</ul>`,
                icon: 'bi-journal-check text-warning', priority: 3
            });
            // // console.log("[generateIndividualTrainingSuggestions V2]   -> Weak questions suggestion added.");
        }
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 4 DONE. Current suggestions count:", suggestions.length);

        // --- 5. 总体评价与学习方法建议 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 5: Generating overall evaluation and learning method...");
        if (overallScoreRate < criticalThreshold) {
             suggestions.push({
               type: 'overall_critical',
               text: `<strong>总体评价：</strong>本次测评成绩 (${overallScoreRate}%) <strong class="text-danger">偏低</strong>，基础知识和核心技能掌握不足。`,
               icon: 'bi-clipboard-x text-danger', priority: 2
           }); // **Fix: Added comma**
           suggestions.push({
               type: 'learning_method_low',
               text: `<strong>学习建议：</strong><strong class="text-danger">必须系统复习</strong>，对照教材/手册，逐一攻克薄弱点，多向同事或师傅请教，增加实操练习。`,
               icon: 'bi-mortarboard-fill text-danger', priority: 2
           });
           // // console.log("[generateIndividualTrainingSuggestions V2]   -> Critical overall evaluation added.");
        } else if (overallScoreRate < weakThreshold) {
           suggestions.push({
               type: 'overall_weak',
               text: `<strong>总体评价：</strong>本次测评成绩 (${overallScoreRate}%) <strong class="text-warning">有待提高</strong>，部分知识点掌握不够牢固。`,
               icon: 'bi-clipboard-minus text-warning', priority: 3
           }); // **Fix: Added comma**
           suggestions.push({
               type: 'learning_method_medium',
               text: `<strong>学习建议：</strong><strong class="text-warning">查漏补缺</strong>，重点巩固易错点，参与模拟演练，加强案例分析。`,
               icon: 'bi-mortarboard-fill text-warning', priority: 3
           });
           // // console.log("[generateIndividualTrainingSuggestions V2]   -> Weak overall evaluation added.");
        } else if (overallScoreRate < goodThreshold) {
           suggestions.push({
               type: 'overall_good',
               text: `<strong>总体评价：</strong>本次测评成绩 (${overallScoreRate}%) <strong class="text-success">良好</strong>，基本掌握了岗位要求。`,
               icon: 'bi-clipboard-check text-success', priority: 4
           }); // **Fix: Added comma**
           suggestions.push({
               type: 'learning_method_good',
               text: `<strong>学习建议：</strong><strong class="text-success">持续学习</strong>，关注业务更新和新技术，尝试解决更复杂的问题。`,
               icon: 'bi-mortarboard-fill text-success', priority: 4
           });
           // // console.log("[generateIndividualTrainingSuggestions V2]   -> Good overall evaluation added.");
        } else { 
           suggestions.push({
               type: 'overall_excellent',
               text: `<strong>总体评价：</strong>本次测评成绩 (${overallScoreRate}%) <strong class="text-primary">优秀</strong>，熟练掌握各项技能！`,
               icon: 'bi-clipboard-data text-primary', priority: 5
           }); // **Fix: Added comma**
           suggestions.push({
               type: 'learning_method_excellent',
               text: `<strong>学习建议：</strong><strong class="text-primary">保持领先</strong>，可以深入研究特定领域，分享经验，参与指导新员工。`,
               icon: 'bi-mortarboard-fill text-primary', priority: 5
           });
           // // console.log("[generateIndividualTrainingSuggestions V2]   -> Excellent overall evaluation added.");
        }
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 5 DONE. Current suggestions count:", suggestions.length);

        // --- 6. 最终检查与默认建议 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 6: Final checks and default suggestion...");
    if (suggestions.length === 0) {
         suggestions.push({
                type: 'default_ok',
                text: '本次测评整体表现尚可，请参照具体板块和题目得分，继续学习和巩固。',
                icon: 'bi-info-circle text-secondary',
                priority: 10
            });
            // // console.log("[generateIndividualTrainingSuggestions V2]   -> No specific issues found, adding default suggestion.");
        } else if (!hasCriticalSection && !hasWeakSection && overallScoreRate >= goodThreshold && (!trendSuggestion || !trendSuggestion.type.includes('down'))) {
            suggestions.push({
                type: 'overall_praise',
                text: '综合来看，您对岗位知识掌握非常扎实，表现出色！',
                icon: 'bi-hand-thumbs-up-fill text-primary',
                priority: 5 // 让它排在优秀评价和学习建议之后
            });
            // // console.log("[generateIndividualTrainingSuggestions V2]   -> Adding praise suggestion.");
        }
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 6 DONE. Current suggestions count:", suggestions.length);

        // --- 7. 排序与返回 ---
        // // console.log("[generateIndividualTrainingSuggestions V2] Step 7: Sorting and returning suggestions...");
        suggestions.sort((a, b) => a.priority - b.priority);
        // // console.log("[generateIndividualTrainingSuggestions V2] FINAL Generated Suggestions (before return):", JSON.parse(JSON.stringify(suggestions))); // Deep copy for logging
        return suggestions;

    } catch (error) {
        // **** Catch any unexpected errors ****
        console.error("[generateIndividualTrainingSuggestions V2] UNEXPECTED ERROR during execution:", error);
        // Return a generic error suggestion
        return [{ type: 'error', text: '生成培训建议时发生内部错误，请联系管理员。 ', icon: 'bi-exclamation-diamond-fill text-danger', priority: -1 }];
    }
}

// **** 确保 displayIndividualTrainingSuggestions 函数存在 ****
// (这个函数可能不需要修改，因为它主要依赖于 suggestion 对象的 text 和 icon 属性)
function displayIndividualTrainingSuggestions(suggestions) {
    const list = document.getElementById('individualTrainingSuggestions');
     if (!list) return;
    list.innerHTML = '';

     if (suggestions && suggestions.length > 0) {
        suggestions.forEach(s => {
            const li = document.createElement('li');
             // 优先使用 s.type 来决定样式，如果 s.icon 存在则覆盖
            let iconClass = 'bi-info-circle'; // Default
            if (s.type?.includes('error')) iconClass = 'bi-x-octagon-fill text-danger';
            else if (s.type?.includes('critical')) iconClass = 'bi-exclamation-triangle-fill text-danger';
            else if (s.type?.includes('weak') || s.type?.includes('medium')) iconClass = 'bi-exclamation-circle-fill text-warning';
             else if (s.type?.includes('good')) iconClass = 'bi-check-circle-fill text-success';
             else if (s.type?.includes('excellent') || s.type?.includes('praise')) iconClass = 'bi-star-fill text-primary'; // 或者用 bi-hand-thumbs-up-fill
             else if (s.type?.includes('trend_up')) iconClass = 'bi-graph-up-arrow text-success';
             else if (s.type?.includes('trend_down')) iconClass = 'bi-graph-down-arrow text-danger';
             else if (s.type?.includes('stable')) iconClass = 'bi-dash-lg text-secondary';
             else if (s.type?.includes('learning')) iconClass = 'bi-mortarboard-fill'; // 学习方法用统一图标，颜色由文字决定

             if(s.icon) iconClass = s.icon; // 如果对象直接提供了icon，则使用它

             li.className = 'list-group-item border-0 px-0'; // 使用无边框列表项
             li.innerHTML = `<div class="d-flex align-items-start">
                                <i class="bi ${iconClass} me-2 mt-1" style="font-size: 1.1rem; min-width: 1.1em;"></i>
                                <div class="suggestion-text">${s.text || '无建议内容'}</div>
                             </div>`;
            list.appendChild(li);
        });
    } else {
        // 修改默认无建议的提示
        list.innerHTML = '<li class="list-group-item border-0 px-0"><i class="bi bi-check-circle-fill text-success me-2"></i> 综合分析显示您当前掌握情况良好，暂无特别的改进建议，请继续保持！</li>';
    }
}

// **** 删除旧的（占位的） generateIndividualTrainingSuggestions 函数 ****
// (大约在 1703 行附近，如果存在的话)

// **** 删除旧的（占位的） generateCombinedTrainingSuggestions 函数 ****
// (大约在 1707 行附近，如果存在的话)
// function generateCombinedTrainingSuggestions(records) { /* ... implement ... */ }

// **** 重新定义：生成多次测评综合培训建议 ****
function generateCombinedTrainingSuggestions(records) {
    // // console.log("[generateCombinedTrainingSuggestions V2] Generating combined suggestions for", records.length, "records");
    const suggestions = [];
    if (!records || records.length === 0) {
         return [{ type: 'warning', text: '无法生成综合建议：缺少测评记录数据。', icon: 'bi-exclamation-circle-fill text-warning', priority: 0 }];
    }

    const avgSectionScores = calculateAverageSectionScores(records);
    const combinedQuestionPerformance = analyzeCombinedQuestionPerformance(records);
    const historyData = records.map(r => ({ timestamp: r.timestamp || r.endTime, scoreRate: r.score?.scoreRate || 0 }))
                            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const criticalThreshold = 70; // 综合分析阈值可适当调整
    const weakThreshold = 85;

    // 1. 综合板块表现
    const sortedSections = Object.entries(avgSectionScores).sort(([, rateA], [, rateB]) => rateA - rateB);
    let hasWeakCombinedSection = false;
    sortedSections.forEach(([section, rate]) => {
        if (rate < criticalThreshold) {
            hasWeakCombinedSection = true;
            suggestions.push({
                priority: 1, icon: 'bi-bar-chart-steps text-danger',
                text: `<strong>长期薄弱板块：</strong> ${section} 板块在 ${records.length} 次测评中平均得分率 (${rate}%) 持续偏低，需制定<strong class="text-danger">针对性提升计划</strong>。`
            });
        } else if (rate < weakThreshold) {
            suggestions.push({
                priority: 2, icon: 'bi-bar-chart-line text-warning',
                text: `<strong>有待巩固板块：</strong> ${section} 板块平均得分率 (${rate}%) 有提升空间，建议<strong class="text-warning">阶段性复习</strong>。`
            });
        }
    });

    // 2. 综合题目表现 (最差的几个)
    if (combinedQuestionPerformance.worst.length > 0) {
         let questionListHTML = combinedQuestionPerformance.worst.slice(0, 3).map(q =>
             `<li class="mb-1">${q.content || '无内容'} <span class="badge bg-danger">平均: ${q.avgScoreRate}%</span></li>`
         ).join('');
         suggestions.push({
            priority: 1, icon: 'bi-card-list text-danger',
            text: `<strong>常见失分题目：</strong> 以下题目在多次测评中平均得分率较低，需<strong class="text-danger">重点攻克</strong>：<ul class="list-unstyled small ms-3 mt-1">${questionListHTML}</ul>`
        });
    }

    // 3. 总体趋势分析
    if (historyData.length >= 3) { // 至少需要3个点判断趋势
        const firstRate = historyData[0].scoreRate;
        const lastRate = historyData[historyData.length - 1].scoreRate;
        const trendDiff = lastRate - firstRate;
        if (trendDiff < -5) {
            suggestions.push({
                priority: 0, icon: 'bi-graph-down text-danger',
                text: `<strong>长期趋势：</strong> 从 ${formatSimpleDateTime(historyData[0].timestamp)} (${firstRate}%) 到 ${formatSimpleDateTime(historyData[historyData.length-1].timestamp)} (${lastRate}%)，整体成绩呈<strong class="text-danger">下降趋势</strong>，需警惕！`
            });
        } else if (trendDiff > 5) {
             suggestions.push({
                priority: 3, icon: 'bi-graph-up text-success',
                text: `<strong>长期趋势：</strong> 从 ${formatSimpleDateTime(historyData[0].timestamp)} (${firstRate}%) 到 ${formatSimpleDateTime(historyData[historyData.length-1].timestamp)} (${lastRate}%)，整体成绩呈<strong class="text-success">上升趋势</strong>，值得肯定！`
            });
        } else {
            suggestions.push({
                priority: 4, icon: 'bi-graph-up text-secondary',
                text: `<strong>长期趋势：</strong> 整体成绩保持相对稳定（从 ${firstRate}% 到 ${lastRate}%）。`
            });
        }
    }

    // 4. 综合总结建议
    if (suggestions.length === 0) {
         suggestions.push({
            priority: 5, icon: 'bi-check2-all text-success',
            text: '综合多次测评结果，您在各方面表现均比较稳定且良好，请继续保持学习热情！'
        });
    } else if (!hasWeakCombinedSection) {
        suggestions.push({
            priority: 4, icon: 'bi-check-circle text-success',
            text: '综合来看，各知识板块掌握情况较好，请重点关注上述提到的个别题目或趋势。'
        });
    }

    suggestions.sort((a, b) => a.priority - b.priority);
    // // console.log("[generateCombinedTrainingSuggestions V2] Generated Suggestions:", suggestions);
    return suggestions;
}

// 工具函数 (如果 main.js 中没有的话)
function formatDate(dateString) {
    if (!dateString) return 'N/A';
     try {
         const date = new Date(dateString);
         return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
     } catch (e) {
         return dateString;
     }
}

// --- 员工列表管理 ---

// **** 重构：从云端加载员工列表 ****
async function loadEmployeeList(callback) { 
    console.log("[loadEmployeeList] 开始从云端加载员工列表...");
    const employeeSelect = document.getElementById('employeeSelect');
    const placeholderElement = document.getElementById('individualAnalysisPlaceholder'); // 用于显示错误
    
    if (!employeeSelect) {
        console.error("[loadEmployeeList] 找不到 employeeSelect 元素");
        return;
    }
    
    // 清空现有选项，保留默认选项
    employeeSelect.innerHTML = '<option value="">-- 正在加载员工... --</option>';
    employeeSelect.disabled = true; // 禁用直到加载完成
    
    try {
        // 查询 UserProfile 表获取所有员工信息
        const query = new AV.Query('UserProfile');
        query.limit(1000); // 假设员工数量不超过1000，否则需要分页
        // 可以按需添加排序，例如按 employeeId 或 name
        query.addAscending('employeeId'); 
        
        const results = await query.find();
        console.log(`[loadEmployeeList] 从云端查询到 ${results.length} 个 UserProfile 记录.`);
        
        // 将查询结果存储到全局变量（如果其他地方需要）
        allEmployees = results.map(user => ({
            id: user.id, // UserProfile 的 objectId
            name: user.get('name') || '未命名', // 获取 name 属性
            employeeId: user.get('employeeId'), // 获取 employeeId 属性
            position: user.get('positionCode') // 获取 positionCode 属性
        }));
        
        console.log("[loadEmployeeList] 构建完成的 allEmployees 数组:", allEmployees);

        // 清空下拉列表（除了默认选项）
        employeeSelect.innerHTML = '<option value="">-- 请选择员工 --</option>';

        if (allEmployees.length === 0) {
            employeeSelect.innerHTML = '<option value="">未找到员工信息</option>';
            if (placeholderElement) {
                placeholderElement.innerHTML = 
                    '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>云端未找到任何员工信息 (UserProfile 表为空或查询失败)。</div>';
                placeholderElement.style.display = 'block';
            }
             console.warn("[loadEmployeeList] 云端未找到 UserProfile 记录。");
        } else {
            // 填充下拉列表
            allEmployees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id; // 使用 UserProfile 的 objectId 作为 value
                option.textContent = `${employee.name} (${employee.employeeId || '无工号'})`;
                employeeSelect.appendChild(option);
            });
            employeeSelect.disabled = false; // 启用下拉框
            // 初始加载后，可以调用一次按岗位筛选，以匹配岗位筛选器的初始状态
            filterEmployeesByPosition(); 
        }
        
    } catch (error) {
        console.error("[loadEmployeeList] 从云端加载员工列表失败:", error);
        employeeSelect.innerHTML = '<option value="">加载员工失败</option>';
        if (placeholderElement) {
             placeholderElement.innerHTML = 
                `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>加载员工列表失败: ${error.message}</div>`;
             placeholderElement.style.display = 'block';
        }
    }
    
    // 无论成功失败，都执行回调（如果提供了）
    if (typeof callback === 'function') {
        callback();
    }
    console.log("[loadEmployeeList] 结束.");
}

// 新增：加载员工列表并预选员工及测评记录
function loadEmployeeListAndSelect(employeeIdToSelect, assessmentIdToSelect) {
    loadEmployeeList(() => {
        // // // console.log(`Callback after loadEmployeeList: Selecting employee ${employeeIdToSelect}`);
        // 确保员工下拉列表已填充
        const employeeSelect = document.getElementById('employeeSelect');
        if (employeeSelect) {
            // 设置选中的员工
            employeeSelect.value = employeeIdToSelect;
            // 触发加载测评记录列表
            loadEmployeeAssessments(() => {
                // // // console.log(`Callback after loadEmployeeAssessments: Selecting assessment ${assessmentIdToSelect}`);
                 // 确保测评记录下拉列表已填充
                 const recordSelect = document.getElementById('assessmentRecordSelect');
                 if (recordSelect) {
                     // **** 添加日志 ****
                     // // // // console.log(`[Debug] loadEmployeeListAndSelect: Setting recordSelect.value to assessmentIdToSelect = ${assessmentIdToSelect}`);
                     recordSelect.value = assessmentIdToSelect; 
                     // **** 添加日志 ****
                     // // // // console.log(`[Debug] loadEmployeeListAndSelect: Calling loadIndividualAnalysisFromSelection after setting value.`);
                     loadIndividualAnalysisFromSelection(); // 触发加载
                 } else {
                     console.error("无法找到 assessmentRecordSelect 元素");
                 }
            });
        } else {
            console.error("无法找到 employeeSelect 元素");
        }
    });
}

// **** 修改：从云端加载员工的测评记录 ****
async function loadEmployeeAssessments() {
    const employeeSelect = document.getElementById('employeeSelect');
    const assessmentRecordSelect = document.getElementById('assessmentRecordSelect');
    const selectedEmployeeId = employeeSelect ? employeeSelect.value : null;
    const loadingOptionText = '-- 正在加载记录... --';
    const noEmployeeText = '-- 请先选择员工 --';
    const noRecordsText = '该员工无测评记录';

    console.log(`[loadEmployeeAssessments] 开始加载测评记录. 选中的员工 ID: ${selectedEmployeeId}`);

    // 重置下拉框状态
    assessmentRecordSelect.innerHTML = `<option value="">${loadingOptionText}</option>`;
    assessmentRecordSelect.disabled = true;
    clearIndividualAnalysis(); // 清空旧分析

    if (!selectedEmployeeId) {
        assessmentRecordSelect.innerHTML = `<option value="">${noEmployeeText}</option>`;
        console.log("[loadEmployeeAssessments] 未选择员工，退出。");
        return;
    }

    try {
        // 1. 根据 employeeId 找到 UserProfile 对象
        const userQuery = new AV.Query('UserProfile');
        // 假设 employeeSelect 的 value 就是 UserProfile 的 objectId
        // 如果不是，需要先根据 employeeId 查询 UserProfile objectId
        // 确认 employeeSelect.value 是什么？ 从 loadEmployeeList 看，value 是 user.id (objectId)
        const userObject = AV.Object.createWithoutData('UserProfile', selectedEmployeeId);
        console.log(`[loadEmployeeAssessments] 准备查询员工 UserProfile: ${selectedEmployeeId}`);
        // 可以选择性地 fetch 一下确认用户存在，但非必需
        // await userObject.fetch(); 
        
        console.log(`[loadEmployeeAssessments] 查询该用户的 Assessment 记录, userPointer 指向: ${userObject.id}`);

        // 2. 查询该用户的所有 Assessment 记录
        const assessmentQuery = new AV.Query('Assessment');
        assessmentQuery.equalTo('userPointer', userObject); // 关键筛选条件
        assessmentQuery.limit(1000); // 获取最多1000条记录，如果可能超过需要分页
        assessmentQuery.addDescending('endTime'); // 按结束时间降序排列
        // 可能需要包含 userPointer 信息以防万一？虽然我们已经有 userObject 了
        // assessmentQuery.include('userPointer'); 

        const employeeAssessments = await assessmentQuery.find();
        console.log(`[loadEmployeeAssessments] 从云端查询到 ${employeeAssessments.length} 条记录.`);

        if (employeeAssessments.length === 0) {
            assessmentRecordSelect.innerHTML = `<option value="">${noRecordsText}</option>`;
            console.log("[loadEmployeeAssessments] 未找到该员工的云端记录.");
            return;
        }

        // 3. 填充测评记录下拉框
        assessmentRecordSelect.innerHTML = ''; // 清空 "加载中..."

        // 添加综合分析选项
        if (employeeAssessments.length > 0) {
            const summaryOption = document.createElement('option');
            summaryOption.value = 'all';
            summaryOption.textContent = `所有记录 (${employeeAssessments.length}条) - 综合分析`;
            assessmentRecordSelect.appendChild(summaryOption);
            console.log("[loadEmployeeAssessments] 已添加 '综合分析 (all)' 选项.");
        }

        employeeAssessments.forEach(record => {
            const option = document.createElement('option');
            option.value = record.id; // 使用云端记录的 objectId
            const recordDate = record.get('endTime') || new Date(); // 使用 endTime
            const scoreRate = record.get('scoreRate');
            const scoreRateText = (scoreRate !== undefined && scoreRate !== null) ? `${scoreRate}%` : 'N/A';
            // 获取岗位信息
            const positionCode = record.get('positionCode');
            const positionName = getPositionName(positionCode);
            
            option.textContent = `${formatSimpleDateTime(recordDate)} - ${positionName} - 得分率: ${scoreRateText}`;
            console.log(`[loadEmployeeAssessments]   -> 添加记录选项: ID='${record.id}', Text='${option.textContent}'`);
            assessmentRecordSelect.appendChild(option);
        });

        assessmentRecordSelect.disabled = false;

        // 默认触发加载综合分析
        if (assessmentRecordSelect.querySelector('option[value="all"]')) {
            assessmentRecordSelect.value = 'all'; // 默认选中综合分析
            console.log("[loadEmployeeAssessments] 默认选中 '综合分析 (all)' 并将加载分析.");
            loadIndividualAnalysisFromSelection(); // 触发加载
        } else {
             console.warn("[loadEmployeeAssessments] 逻辑错误：查询到记录但未添加'all'选项？");
             // Fallback: 如果没有 'all' 但有记录，加载第一条
             if(employeeAssessments.length > 0) {
                assessmentRecordSelect.value = employeeAssessments[0].id;
                loadIndividualAnalysisFromSelection();
             }
        }

    } catch (error) {
        console.error("[loadEmployeeAssessments] 从云端加载测评记录失败:", error);
        assessmentRecordSelect.innerHTML = `<option value="">加载记录失败</option>`;
        // 可选：显示更详细的错误信息
        alert(`加载员工测评记录失败: ${error.message}`);
    }
    console.log("[loadEmployeeAssessments] 结束.");
}

// **** 修改: 处理综合分析和单次分析的加载 (需要适配云端数据) ****
async function loadIndividualAnalysisFromSelection() {
    const assessmentRecordSelect = document.getElementById('assessmentRecordSelect');
    const employeeSelect = document.getElementById('employeeSelect');
    const selectedValue = assessmentRecordSelect ? assessmentRecordSelect.value : null; // 记录ID(objectId)或'all'
    const selectedEmployeeId = employeeSelect ? employeeSelect.value : null; // UserProfile objectId
    const placeholderElement = document.getElementById('individualAnalysisPlaceholder');
    const contentElement = document.getElementById('individualAnalysisContent');

    console.log(`[loadIndividualAnalysisFromSelection] START. EmployeeID: ${selectedEmployeeId}, Selected Record Value: ${selectedValue}`);

    // 清空现有内容并准备显示加载状态
    clearIndividualAnalysis(); 
    placeholderElement.innerHTML = '<p class="text-muted text-center mt-3"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>正在加载分析数据...</p>';
    placeholderElement.style.display = 'block'; 
    contentElement.style.display = 'none';

    if (!selectedValue || !selectedEmployeeId) {
        console.warn("[loadIndividualAnalysisFromSelection] Missing employee or record selection.");
        placeholderElement.innerHTML = '<p class="text-muted text-center mt-3">请在上方筛选并选择员工及测评记录。</p>';
        return;
    }

    try {
        let analysisTitle = '';
        let recordsToAnalyze = []; // Array of Assessment objects
        let detailsMap = {}; // { assessmentId: [AssessmentDetail objects] }
        const userObject = AV.Object.createWithoutData('UserProfile', selectedEmployeeId);

        if (selectedValue === 'all') {
            // --- 综合分析 --- 
            console.log(`[loadIndividualAnalysisFromSelection] 查询员工 ${selectedEmployeeId} 的所有 Assessment 记录 (用于综合分析)...`);
            const assessmentQuery = new AV.Query('Assessment');
            assessmentQuery.equalTo('userPointer', userObject);
            assessmentQuery.limit(1000); // 假设最多1000条，否则需分页
            assessmentQuery.addAscending('endTime'); // 按时间升序，用于趋势图
            assessmentQuery.include('userPointer'); // 包含 userPointer 以获取姓名
            recordsToAnalyze = await assessmentQuery.find();
            console.log(`[loadIndividualAnalysisFromSelection] 查询到 ${recordsToAnalyze.length} 条记录用于综合分析.`);

            if (recordsToAnalyze.length > 0) {
                // 获取姓名时进行空值检查
                const userPointer = recordsToAnalyze[0].get('userPointer');
                const employeeName = userPointer ? userPointer.get('name') : `员工 ${selectedEmployeeId}`; 
                analysisTitle = `${employeeName} - 所有 ${recordsToAnalyze.length} 条记录综合分析`;
            } else {
                 analysisTitle = `员工 ${selectedEmployeeId} 无可分析的记录`;
            }
            // 综合分析目前不主动加载 details

        } else {
            // --- 单次分析 --- 
            const assessmentId = selectedValue;
            console.log(`[loadIndividualAnalysisFromSelection] 查询单条 Assessment 记录: ${assessmentId}...`);
            const assessmentQuery = new AV.Query('Assessment');
            assessmentQuery.include('userPointer'); // 包含用户信息
            const selectedRecord = await assessmentQuery.get(assessmentId);
            console.log("[loadIndividualAnalysisFromSelection] 成功获取单条 Assessment 记录.");

            if (selectedRecord) {
                recordsToAnalyze.push(selectedRecord); // 分析函数期望数组
                // 获取姓名时进行空值检查
                const userPointer = selectedRecord.get('userPointer');
                const employeeName = userPointer ? userPointer.get('name') : `员工 ${selectedEmployeeId}`;
                analysisTitle = `${employeeName} - ${formatSimpleDateTime(selectedRecord.get('endTime'))} 测评记录`;
                console.log(`[loadIndividualAnalysisFromSelection] 设置标题: ${analysisTitle}`);

                // 加载该次测评的详细题目数据 (AssessmentDetail)
                console.log(`[loadIndividualAnalysisFromSelection] 查询 Assessment ${assessmentId} 关联的 AssessmentDetail...`);
                const detailQuery = new AV.Query('AssessmentDetail');
                detailQuery.equalTo('assessmentPointer', selectedRecord); // 关键关联
                detailQuery.limit(1000); // 假设一次测评题目不超过1000
                const details = await detailQuery.find();
                detailsMap[assessmentId] = details; // 存储详情
                console.log(`[loadIndividualAnalysisFromSelection] 查询到 ${details.length} 条 AssessmentDetail 记录.`);

            } else {
                console.error(`[loadIndividualAnalysisFromSelection] 错误: 未能在云端找到 ID 为 ${assessmentId} 的记录.`);
                throw new Error(`未找到 ID 为 ${assessmentId} 的测评记录`); // 抛出错误以便 catch 处理
            }
        }

        // --- 数据获取完毕，准备分析 --- 

        if (recordsToAnalyze.length === 0) {
            console.warn("[loadIndividualAnalysisFromSelection] 未找到可分析的记录.");
            placeholderElement.innerHTML = '<p class="text-muted text-center mt-3">未找到符合条件的测评记录，无法加载分析。</p>';
            return;
        }

        // 更新分析标题
        document.getElementById('selectedEmployeeInfo').textContent = analysisTitle;

        // 显示内容区域，隐藏加载提示
        placeholderElement.style.display = 'none';
        contentElement.style.display = 'block';
        console.log("[loadIndividualAnalysisFromSelection] 切换可见性: Placeholder hidden, Content shown.");

        // **** 调用分析和渲染函数 (generateIndividualAnalysis 仍需修改以接收新数据) ****
        // **** 传递 recordsToAnalyze (Assessment 对象数组) 和 detailsMap ****
        generateIndividualAnalysis(recordsToAnalyze, detailsMap); 
        console.log("[loadIndividualAnalysisFromSelection] END.");

    } catch (error) {
        console.error("[loadIndividualAnalysisFromSelection] 加载个人分析数据失败:", error);
        placeholderElement.innerHTML = `<p class="text-danger text-center mt-3"><i class="bi bi-exclamation-triangle-fill me-2"></i>加载分析失败: ${error.message}</p>`;
        placeholderElement.style.display = 'block'; // 确保错误信息可见
        contentElement.style.display = 'none'; // 隐藏内容区域
    }
}

// **** generateIndividualAnalysis 及后续函数仍需修改 ****
function generateIndividualAnalysis(records /*, detailsMap = {} */) {
    // ... existing code ...
}

// 计算个人单次测评各板块得分 (保持不变)
function calculateIndividualSectionScores(record) { /* ... */ }

// 计算多次测评平均板块得分率 (新增)
function calculateAverageSectionScores(records) {
    // 返回格式: { sectionName: averageScoreRate }
    const sectionDataAggregated = {}; // { sectionName: { totalScoreRateSum: number, recordCount: number } }
    let validRecordCount = 0;

    if (!records || records.length === 0) return {};

    records.forEach(record => {
        if (!record || !record.questions || !record.answers) return; 
        validRecordCount++;
        const recordSectionPerformance = {}; // { section: { score: 0, max: 0 } }

        // 1. Calculate score and max for each section *within this record*
        record.questions.forEach(q => {
            if (!q || !q.id || !record.answers.hasOwnProperty(q.id)) return;

            const section = q.section || '未分类';
            const answer = record.answers[q.id];
            const standardScore = (q.standardScore !== undefined && q.standardScore !== null) ? Number(q.standardScore) : 0;
            const currentScore = (answer && answer.score !== undefined && answer.score !== null && !isNaN(answer.score)) ? Number(answer.score) : 0;

            if (!recordSectionPerformance[section]) {
                recordSectionPerformance[section] = { score: 0, max: 0 };
            }
            if (standardScore > 0) {
                recordSectionPerformance[section].score += currentScore;
                recordSectionPerformance[section].max += standardScore;
            }
        });

        // 2. Calculate score rate for each section *in this record* and aggregate for averaging
        Object.entries(recordSectionPerformance).forEach(([section, data]) => {
            const scoreRate = data.max > 0 ? (data.score / data.max) * 100 : 0;
            if (!sectionDataAggregated[section]) {
                sectionDataAggregated[section] = { totalScoreRateSum: 0, recordCount: 0 };
            }
            sectionDataAggregated[section].totalScoreRateSum += scoreRate;
            sectionDataAggregated[section].recordCount++;
        });
    });

    // 3. Calculate the final average score rate for each section
    const averageRates = {};
    Object.entries(sectionDataAggregated).forEach(([section, aggregatedData]) => {
        if (aggregatedData.recordCount > 0) {
            averageRates[section] = Math.round(aggregatedData.totalScoreRateSum / aggregatedData.recordCount);
        } else {
            averageRates[section] = 0; // Should not happen if recordCount > 0
        }
    });
    
    console.log(`[calculateAverageSectionScores] Calculated Average Rates over ${validRecordCount} valid records:`, averageRates);
    return averageRates; // { sectionName: averageRate }
}

// 分析单次测评题目掌握情况 (保持不变)
function analyzeQuestionPerformance(record) { /* ... */ }

// 分析多次测评综合题目掌握情况 (新增)
function analyzeCombinedQuestionPerformance(records) { /* ... implement ... */ 
     // // // // // // // console.log("Analyzing combined question performance for", records.length, "records");
    const questionStats = {}; // { questionId: { content: '...', totalScore: 0, totalMaxScore: 0, appearances: 0 } }

    records.forEach(record => {
        if (!record.questions || !record.answers) return;
        record.questions.forEach(q => {
            if (!questionStats[q.id]) {
                questionStats[q.id] = {
                    content: q.content,
                    totalScore: 0,
                    totalMaxScore: 0,
                    appearances: 0
                };
            }
            const answer = record.answers[q.id];
            const score = (answer && answer.score !== null && !isNaN(answer.score)) ? answer.score : 0;
            const maxScore = q.standardScore || 0;

            questionStats[q.id].totalScore += score;
            questionStats[q.id].totalMaxScore += maxScore;
            questionStats[q.id].appearances++;
        });
    });

    const performanceList = Object.entries(questionStats).map(([id, stats]) => ({
        id: id,
        content: stats.content,
        avgScoreRate: (stats.totalMaxScore > 0) ? Math.round((stats.totalScore / stats.totalMaxScore) * 100) : 0,
        appearances: stats.appearances
    }));

    performanceList.sort((a, b) => b.avgScoreRate - a.avgScoreRate); // Sort best to worst

    const best = performanceList.slice(0, 5); // Show top 5 best
    const worst = performanceList.filter(q => q.avgScoreRate < 80).reverse().slice(0, 5); // Show bottom 5 worst (below 80% avg)
    
    // // // // // // // console.log("Combined Best Questions:", best);
    // // // // // // // // console.log("Combined Worst Questions:", worst);
    return { best, worst };
}

// 生成多次测评综合培训建议 (新增)
function generateCombinedTrainingSuggestions(records) { /* ... implement ... */ 
     // // // // // // // // console.log("Generating combined training suggestions for", records.length, "records");
    const avgSectionScores = calculateAverageSectionScores(records);
    const suggestions = [];
    const sortedSections = Object.entries(avgSectionScores).sort(([, rateA], [, rateB]) => rateA - rateB);

    sortedSections.forEach(([section, rate]) => {
        if (rate < 70) {
            suggestions.push({ text: `加强 ${section} 板块的复习和练习，平均得分率较低 (${rate}%)。`, type: 'danger' });
        } else if (rate < 85) {
            suggestions.push({ text: `关注 ${section} 板块，有提升空间 (平均得分率 ${rate}%)。`, type: 'warning' });
        }
    });

    if (suggestions.length === 0) {
         suggestions.push({ text: '整体表现良好，请继续保持！', type: 'success' });
    }
    // // // // // // // // console.log("Combined Suggestions:", suggestions);
    return suggestions;
}

// --- 渲染函数 --- 

// 渲染题目列表 
function renderQuestionPerformanceLists(questions, listId, isCombined = false) {
    // // // // // // // // console.log(`[renderQuestionPerformanceLists] START. List ID: ${listId}, isCombined: ${isCombined}. Data:`, questions);
    const listElement = document.getElementById(listId);
    if (!listElement) {
        console.error(`[renderQuestionPerformanceLists] ERROR: Cannot find list element with ID: ${listId}`);
        return;
    }
    // // // // // // // console.log(`[renderQuestionPerformanceLists] Found list element:`, listElement);
    listElement.innerHTML = ''; // Clear previous items

    if (!questions || questions.length === 0) {
        listElement.innerHTML = '<li class="list-group-item text-muted small">无相关题目</li>';
        console.log(`[renderQuestionPerformanceLists] No questions to display for ${listId}.`);
        console.log(`[renderQuestionPerformanceLists] END for ${listId}.`);
        return;
    }

    try {
        questions.forEach((q, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item small d-flex justify-content-between align-items-center';
            let text = q.content || '无内容';
            let scoreInfo = '';
            if (isCombined) {
                scoreInfo = `<span class="badge bg-secondary rounded-pill">平均: ${q.avgScoreRate !== undefined ? q.avgScoreRate + '%' : 'N/A'} (出现 ${q.appearances || 0}次)</span>`;
            } else {
                const score = q.score !== undefined ? q.score : 'N/A';
                const standardScore = q.standardScore !== undefined ? q.standardScore : 'N/A';
                // **** 修改：如果是待提高列表，使用红色背景 ****
                const badgeBgClass = listId.includes('Worst') ? 'bg-danger' : 'bg-secondary';
                scoreInfo = `<span class="badge ${badgeBgClass} rounded-pill">${score} / ${standardScore}</span>`;
            }
            li.innerHTML = `<span>${text}</span> ${scoreInfo}`;
            listElement.appendChild(li);
            // // // // // // // // console.log(`[renderQuestionPerformanceLists] Appended item ${index + 1} to ${listId}`); // Optional: log each item append
        });
        // // // // // // // // console.log(`[renderQuestionPerformanceLists] Successfully rendered ${questions.length} items to ${listId}.`);
    } catch (error) {
        console.error(`[renderQuestionPerformanceLists] ERROR rendering list ${listId}:`, error);
    }
    console.log(`[renderQuestionPerformanceLists] END for ${listId}.`);
}

// 渲染历史成绩图表
function renderHistoricalScoresChart(historyData) {
    // // // // // // // // console.log('[renderHistoricalScoresChart] START. Data:', historyData);
    const ctx = document.getElementById('historicalScoresChart')?.getContext('2d');
     if (!ctx) {
        console.error('[renderHistoricalScoresChart] ERROR: Cannot get context for historicalScoresChart');
        return;
    }
    // // // // // // // // console.log('[renderHistoricalScoresChart] Got canvas context.');

    if (!historyData || historyData.length === 0) {
        // // // // // // // // console.warn('[renderHistoricalScoresChart] No history data to render.');
         if (historicalScoresChartInstance) historicalScoresChartInstance.destroy();
         // Optionally display a message on the canvas or in the card
        // // // // // // // // console.log('[renderHistoricalScoresChart] END (no data).');
        return;
    }

    const labels = historyData.map(record => formatSimpleDateTime(record.timestamp)); // Use simplified format
    const data = historyData.map(record => record.scoreRate || 0);

     if (historicalScoresChartInstance) {
        // // // // // // // // console.log('[renderHistoricalScoresChart] Destroying previous chart instance.');
        historicalScoresChartInstance.destroy();
    }

    try {
        historicalScoresChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '历史得分率 (%)',
                    data: data,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 scales: {
                     y: {
                         beginAtZero: true,
                         max: 100
                     }
                 },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `得分率: ${context.parsed.y}%`;
                            }
                        }
                    }
                }
            }
        });
        // // // // // // // // console.log('[renderHistoricalScoresChart] New chart instance created.');
    } catch(error) {
         console.error('[renderHistoricalScoresChart] ERROR creating chart:', error);
    }
    // // // // // // // // console.log('[renderHistoricalScoresChart] END.');
}

// 渲染培训建议
function renderTrainingSuggestions(suggestions, listId) {
    // // // // // // // // console.log(`[renderTrainingSuggestions] START. List ID: ${listId}. Data:`, suggestions);
    const listElement = document.getElementById(listId);
    if (!listElement) {
        console.error(`[renderTrainingSuggestions] ERROR: Cannot find list element with ID: ${listId}`);
        return;
    }
    // // // // // // // console.log(`[renderTrainingSuggestions] Found list element:`, listElement);
    listElement.innerHTML = ''; // Clear previous items

    if (!suggestions || suggestions.length === 0) {
        listElement.innerHTML = '<li class="list-group-item"><i class="bi bi-check-lg text-success me-2"></i>暂无特别建议。</li>';
        console.log(`[renderTrainingSuggestions] No suggestions to display for ${listId}.`);
        console.log(`[renderTrainingSuggestions] END for ${listId}.`);
        return;
    }

    try {
        suggestions.forEach((s, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            // Adjust based on expected suggestion format (e.g., {text: '...', type: '...'} or other)
            let iconClass = 'bi-info-circle'; // Default icon
            let text = s.text || '无建议内容'; // Default text
            if (s.type === 'danger') iconClass = 'bi-exclamation-triangle-fill text-danger';
            else if (s.type === 'warning') iconClass = 'bi-exclamation-circle-fill text-warning';
            else if (s.type === 'success') iconClass = 'bi-check-circle-fill text-success';
            // Handle potential other structures like the one from generateIndividualTrainingSuggestions
            else if (s.icon) iconClass = s.icon; // Use icon class directly if provided

            li.innerHTML = `<i class="bi ${iconClass} me-2"></i> ${text}`;
            listElement.appendChild(li);
             // // // // // // // // // console.log(`[renderTrainingSuggestions] Appended suggestion ${index + 1} to ${listId}`); // Optional log
        });
        // // // // // // // // // console.log(`[renderTrainingSuggestions] Successfully rendered ${suggestions.length} suggestions to ${listId}.`);
    } catch (error) {
        console.error(`[renderTrainingSuggestions] ERROR rendering list ${listId}:`, error);
    }
    console.log(`[renderTrainingSuggestions] END for ${listId}.`);
}

// 清除图表 (保持不变)
function clearChart(canvasId) { /* ... */ }

// 清空个人分析区域 (保持不变)
function clearIndividualAnalysis() { /* ... */ }

// **** 结束修改/新增 ****

// -------------------------------------------------------
// --- 岗位分析部分 (保持相对独立) ---
// -------------------------------------------------------

// ... (loadPositionAnalysis, calculateSectionMastery, renderSectionMasteryChart, etc.)

// 确保 getPositionName (如果岗位分析部分也需要)
// function getPositionName(code) { ... } // 已经在上面定义

// 确保 formatDate / formatSimpleDateTime
// function formatDate(dateString) { ... } // 应该在上面定义

// ... (其他可能存在的 Helper Functions) ...

// **** 新增：根据岗位筛选员工的函数 ****
function filterEmployeesByPosition() {
    console.log("[filterEmployeesByPosition] 开始根据岗位筛选员工..."); // Start Log
    const employeeSelect = document.getElementById('employeeSelect');
    const positionFilterSelect = document.getElementById('employeePosition');
    
    if (!employeeSelect || !positionFilterSelect) {
        console.error("[filterEmployeesByPosition] 找不到 employeeSelect 或 employeePosition 元素.");
        return;
    }

    const positionFilter = positionFilterSelect.value;
    // **** Log filter value ****
    console.log(`[filterEmployeesByPosition] 当前选择的岗位筛选器值 (positionFilter): '${positionFilter}'`);

    // 清空现有选项
    employeeSelect.innerHTML = '<option value="">-- 请选择员工 --</option>';
    
    // 确保 allEmployees 已被填充
    if (!allEmployees || allEmployees.length === 0) {
        console.warn("[filterEmployeesByPosition] allEmployees 数组为空或未定义，无法筛选。");
        // ... (display message in dropdown)
        return; 
    }
    
    // **** Log allEmployees before filtering ****
    console.log("[filterEmployeesByPosition] 用于筛选的 allEmployees 数组:", JSON.parse(JSON.stringify(allEmployees))); // Deep copy for logging

    // 筛选员工
    const filteredEmployees = positionFilter === 'all' 
        ? allEmployees 
        : allEmployees.filter(employee => {
            const empPos = employee.position || '';
            const match = empPos === positionFilter;
            // **** Log filter check ****
            console.log(`[filterEmployeesByPosition]   检查员工: ID='${employee.id}', 姓名='${employee.name}', 存储的岗位='${empPos}'. ` +
                        `与筛选器 '${positionFilter}' 匹配: ${match}`);
            return match;
          });
    
    // **** Log filtered result ****
    console.log(`[filterEmployeesByPosition] 筛选结果 (filteredEmployees) 包含 ${filteredEmployees.length} 个员工:`, JSON.parse(JSON.stringify(filteredEmployees)));

    if (filteredEmployees.length === 0) {
        // ... (display 'not found' message) ...
    } else {
        // 按姓名排序
        filteredEmployees.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        
        // 添加到下拉列表
        filteredEmployees.forEach(employee => {
            // **** Log adding option ****
            console.log(`[filterEmployeesByPosition]   -> 添加选项到下拉框: ID='${employee.id}', 姓名='${employee.name}'`);
            const option = document.createElement('option');
            option.value = employee.id; 
            option.textContent = `${employee.name} (${employee.id})`;
            employeeSelect.appendChild(option);
        });
    }

     // ... (clear analysis, reset record select) ...
     console.log("[filterEmployeesByPosition] 结束."); // End Log
}

// --- Helper Functions ---
// ... other helper functions like formatSimpleDateTime, getPositionName ...

// **** 确保 getPositionName 在此文件或 main.js 中定义 ****
function getPositionName(code) {
    // 假设 jobPositions 已通过 main.js 的 initializeSystem 加载到 localStorage
    const positions = JSON.parse(localStorage.getItem('jobPositions') || '{}');
    return positions[code] || code || '未知岗位'; // 返回名称或代码或默认值
}

// **** 确保 formatSimpleDateTime 在此文件或 main.js 中定义 ****
function formatSimpleDateTime(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
    } catch (e) {
        console.error("日期格式化错误:", e);
        return isoString;
    }
}

// **** 修改: 岗位分析的图表渲染 ****
// 注意：岗位分析的图表 (`sectionMasteryChart`) 现在显示的是平均得分率，不需要显示"未得分"。
// 它应该接收 `calculatePositionSectionMastery` 返回的 { sectionName: averageRate } 格式数据。
function renderPositionSectionMasteryChart(averageRates, chartTitle = '各板块整体掌握情况 (平均得分率 %)') {
    // console.log('[renderPositionSectionMasteryChart] START. Data:', averageRates, 'Title:', chartTitle);
    const ctx = document.getElementById('sectionMasteryChart')?.getContext('2d');
    if (!ctx) {
        console.error('[renderPositionSectionMasteryChart] ERROR: Cannot get context');
        return;
    }
    // console.log('[renderPositionSectionMasteryChart] Got canvas context.');

    if (!averageRates || Object.keys(averageRates).length === 0) {
        console.warn('[renderPositionSectionMasteryChart] No average rates data.');
        if (positionSectionChartInstance) positionSectionChartInstance.destroy();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center'; ctx.fillStyle = '#6c757d'; 
        ctx.fillText('无板块掌握度数据', ctx.canvas.width / 2, ctx.canvas.height / 2);
        // console.log('[renderPositionSectionMasteryChart] END (no data).');
        return;
    }

    const labels = Object.keys(averageRates);
    const dataValues = Object.values(averageRates); // Percentages

    const backgroundColors = [
        'rgba(111, 66, 193, 0.8)', 'rgba(25, 135, 84, 0.8)', 'rgba(13, 202, 240, 0.8)',
        'rgba(255, 193, 7, 0.8)', 'rgba(220, 53, 69, 0.8)', 'rgba(108, 117, 125, 0.8)'
    ];

    if (positionSectionChartInstance) {
        // console.log('[renderPositionSectionMasteryChart] Destroying previous chart instance.');
        positionSectionChartInstance.destroy();
    }

    try {
        positionSectionChartInstance = new Chart(ctx, {
            type: 'bar', 
            data: {
                labels: labels,
                datasets: [{
                    label: '平均得分率 (%)',
                    data: dataValues,
                    backgroundColor: labels.map((_, i) => backgroundColors[i % backgroundColors.length]),
                    borderColor: labels.map((_, i) => backgroundColors[i % backgroundColors.length].replace('0.8', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', 
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100 
                    }
                },
                plugins: {
                    title: { display: true, text: chartTitle, font: { size: 14 }, padding: { top: 10, bottom: 10 } },
                    legend: { display: false }, 
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.x}%`;
                            }
                        }
                    }
                }
            }
        });
        // console.log('[renderPositionSectionMasteryChart] New chart instance created.');
    } catch (error) {
        console.error('[renderPositionSectionMasteryChart] ERROR creating chart:', error);
    }
    // console.log('[renderPositionSectionMasteryChart] END.');
}

// **** Add definition for analyzeOverallQuestionPerformance ****
function analyzeOverallQuestionPerformance(records) {
    console.log(`[analyzeOverallQuestionPerformance] Analyzing question performance for ${records.length} records.`);
    const questionStats = {}; // { questionId: { content: '...', totalScore: 0, totalMaxScore: 0, appearances: 0 } }

    records.forEach(record => {
        if (!record.questions || !record.answers) return;
        record.questions.forEach(q => {
            if (!q || !q.id) return; // Skip questions without ID
            
            if (!questionStats[q.id]) {
                questionStats[q.id] = {
                    content: q.content || '无内容',
                    totalScore: 0,
                    totalMaxScore: 0,
                    appearances: 0
                };
            }
            
            const answer = record.answers[q.id];
            const standardScore = (q.standardScore !== undefined && q.standardScore !== null) ? Number(q.standardScore) : 0;
            const currentScore = (answer && answer.score !== undefined && answer.score !== null && !isNaN(answer.score)) ? Number(answer.score) : 0;

            // Only include questions with a standard score in the calculation
            if (standardScore > 0) {
                questionStats[q.id].totalScore += currentScore;
                questionStats[q.id].totalMaxScore += standardScore;
                questionStats[q.id].appearances++; // Increment appearances only if scored
            }
        });
    });

    // Calculate average score rate and filter out questions that never appeared with a score
    const performanceList = Object.entries(questionStats)
        .filter(([id, stats]) => stats.appearances > 0) // Ensure question appeared and was scored
        .map(([id, stats]) => ({
            id: id,
            content: stats.content,
            avgScoreRate: (stats.totalMaxScore > 0) ? Math.round((stats.totalScore / stats.totalMaxScore) * 100) : 0,
            appearances: stats.appearances
        }));

    // Sort by average score rate (descending for best, ascending for worst)
    performanceList.sort((a, b) => b.avgScoreRate - a.avgScoreRate);

    // Get Top 3 best and worst
    const best = performanceList.slice(0, 3);
    const worst = performanceList.slice(-3).reverse(); // Get last 3 and reverse to show lowest first
    
    console.log("[analyzeOverallQuestionPerformance] Best performing questions (overall):", best);
    console.log("[analyzeOverallQuestionPerformance] Worst performing questions (overall):", worst);
    
    return { best, worst };
}

// **** Add definition for generateOverallTrainingSuggestions ****
function generateOverallTrainingSuggestions(avgSectionRates) {
    console.log("[generateOverallTrainingSuggestions] Generating suggestions based on average rates:", avgSectionRates);
    const suggestions = [];
    
    // Check if avgSectionRates is valid
    if (!avgSectionRates || typeof avgSectionRates !== 'object' || Object.keys(avgSectionRates).length === 0) {
        console.warn("[generateOverallTrainingSuggestions] Invalid or empty average section rates provided.");
        return [{ text: '无法生成培训建议，板块平均得分数据缺失。', type: 'warning', icon: 'bi-exclamation-circle-fill text-warning' }];
    }
    
    const sortedSections = Object.entries(avgSectionRates).sort(([, rateA], [, rateB]) => rateA - rateB); // Sort lowest rate first

    sortedSections.forEach(([section, rate]) => {
        if (rate < 60) {
            suggestions.push({ text: `板块 <strong class="text-danger">${section}</strong> 平均掌握程度较低 (${rate}%)，建议进行专项培训和重点辅导。`, type: 'danger', icon: 'bi-exclamation-triangle-fill text-danger' });
        } else if (rate < 75) {
            suggestions.push({ text: `板块 <strong class="text-warning">${section}</strong> 平均掌握程度有待提高 (${rate}%)，建议加强相关练习。`, type: 'warning', icon: 'bi-exclamation-circle-fill text-warning' });
        }
    });

    if (suggestions.length === 0) {
        suggestions.push({ text: '各板块平均掌握情况均良好 (>=75%)，请继续保持！', type: 'success', icon: 'bi-check-circle-fill text-success' });
    }
    
    console.log("[generateOverallTrainingSuggestions] Generated suggestions:", suggestions);
    return suggestions;
}

// **** 新增：导出 localStorage 数据 ****
function exportLocalStorageData() {
    try {
        const dataToExport = {};
        // 只导出我们关心的 key
        const keysToExport = ['questionBank', 'assessmentHistory', 'jobPositions'];
        keysToExport.forEach(key => {
            const item = localStorage.getItem(key);
            if (item !== null) {
                try {
                    dataToExport[key] = JSON.parse(item);
                } catch (e) {
                    dataToExport[key] = item; // 保留非JSON字符串
                }
            } else {
                 dataToExport[key] = null;
            }
        });

        const jsonData = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 14);
        a.download = `assessment_data_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('数据已成功导出！');
    } catch (error) {
        console.error('导出数据时出错:', error);
        alert('导出数据失败，请查看控制台获取更多信息。');
    }
}

// **** 新增：处理文件导入并合并数据 ****
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (file.type !== 'application/json') {
        alert('请选择有效的 JSON 文件 (.json)');
        event.target.value = null; // 清空选择
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // 检查导入的数据结构是否基本符合预期
            const importedKeys = Object.keys(importedData);
            const expectedKeys = ['questionBank', 'assessmentHistory']; // 至少应该包含这两项之一
            if (!expectedKeys.some(key => importedKeys.includes(key))) {
                alert('导入的文件似乎不是有效的测评数据备份或格式不正确。请检查文件内容。');
                event.target.value = null;
                return;
            }

            // 确认导入操作
            if (!confirm('导入操作会将文件中的数据与现有数据合并。\n\n- 题库：将添加文件中新的题目，相同 ID 的题目将被文件中的版本覆盖。\n- 测评历史：将添加文件中新的测评记录，相同 ID 的记录将被文件中的版本覆盖。\n\n确定要继续吗？')) {
                event.target.value = null;
                return;
            }

            let newQuestionsAdded = 0;
            let questionsUpdated = 0;
            let newHistoryAdded = 0;
            let historyUpdated = 0;

            // 合并 questionBank (基于 ID)
            if (importedData.questionBank && Array.isArray(importedData.questionBank)) {
                const existingQuestionBankData = localStorage.getItem('questionBank');
                let existingQuestions = existingQuestionBankData ? JSON.parse(existingQuestionBankData) : [];
                const existingQuestionMap = new Map(existingQuestions.map(q => [q.id, q]));

                importedData.questionBank.forEach(importedQuestion => {
                    if (importedQuestion && importedQuestion.id !== undefined) {
                        if (existingQuestionMap.has(importedQuestion.id)) {
                            // 更新现有题目
                            const index = existingQuestions.findIndex(q => q.id === importedQuestion.id);
                            if (index !== -1) {
                                existingQuestions[index] = importedQuestion;
                                questionsUpdated++;
                            }
                        } else {
                            // 添加新题目
                            existingQuestions.push(importedQuestion);
                            newQuestionsAdded++;
                        }
                    }
                });
                localStorage.setItem('questionBank', JSON.stringify(existingQuestions));
            }

            // 合并 assessmentHistory (基于 ID)
            if (importedData.assessmentHistory && Array.isArray(importedData.assessmentHistory)) {
                const existingHistoryData = localStorage.getItem('assessmentHistory');
                let existingHistory = existingHistoryData ? JSON.parse(existingHistoryData) : [];
                const existingHistoryMap = new Map(existingHistory.map(h => [h.id, h]));

                importedData.assessmentHistory.forEach(importedRecord => {
                     if (importedRecord && importedRecord.id !== undefined) {
                         if (existingHistoryMap.has(importedRecord.id)) {
                             // 更新现有记录
                             const index = existingHistory.findIndex(h => h.id === importedRecord.id);
                             if (index !== -1) {
                                 existingHistory[index] = importedRecord;
                                 historyUpdated++;
                             }
                         } else {
                             // 添加新记录
                             existingHistory.push(importedRecord);
                             newHistoryAdded++;
                         }
                     }
                });
                localStorage.setItem('assessmentHistory', JSON.stringify(existingHistory));
            }

            // 更新 jobPositions (可以简单覆盖，或者最好重新计算)
             if (typeof updateAndSaveJobPositions === 'function') { // 检查函数是否存在
                 updateAndSaveJobPositions(); // 导入后重新计算岗位映射
             } else if (importedData.jobPositions) {
                 // 如果没有重新计算的函数，则直接覆盖
                 localStorage.setItem('jobPositions', JSON.stringify(importedData.jobPositions));
             }

            alert(`数据导入并合并完成！\n- 新增题目：${newQuestionsAdded}\n- 更新题目：${questionsUpdated}\n- 新增历史记录：${newHistoryAdded}\n- 更新历史记录：${historyUpdated}\n\n建议刷新页面或重新加载分析数据以查看更改。`);

            // 重新加载数据，或者提示用户刷新
            loadPositionList(); // 更新岗位下拉框
            loadEmployeeList(); // 更新员工下拉框
            clearAnalysisDisplay(); // 清除当前显示的分析结果

        } catch (error) {
            console.error('导入数据时出错:', error);
            alert('导入数据失败，文件可能已损坏或格式不正确。请查看控制台获取更多信息。');
        } finally {
            event.target.value = null; // 清空文件选择
        }
    };

    reader.onerror = function(error) {
        console.error('读取文件时出错:', error);
        alert('读取文件失败。');
        event.target.value = null;
    };

    reader.readAsText(file);
}

// **** 结束新增导入导出函数 ****

// **** 新增：渲染单个板块得分的迷你饼图 ****
function renderSectionBreakdownChart(sectionName, achievedScore, maxScore, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[renderSectionBreakdownChart] Error: Container #${containerId} not found.`);
        return;
    }

    // 清理旧图表（如果需要重新渲染）
    // container.innerHTML = '';

    // 创建图表容器和标题
    const chartDiv = document.createElement('div');
    chartDiv.className = 'col-md-6 col-lg-4 mb-3'; // 调整布局
    chartDiv.innerHTML = `
        <div class="card h-100 shadow-sm">
            <div class="card-header text-center small fw-bold">${sectionName}</div>
            <div class="card-body p-2">
                <div style="height: 150px; position: relative;">
                    <canvas id="breakdown-${sectionName.replace(/\s+/g, '-')}"></canvas>
                </div>
                <p class="card-text text-center small mt-2 mb-0">
                    得分: ${achievedScore} / ${maxScore}
                </p>
                <p class="card-text text-center small mb-0">
                    掌握率: ${maxScore > 0 ? Math.round((achievedScore / maxScore) * 100) : 0}%
                </p>
            </div>
        </div>
    `;
    container.appendChild(chartDiv);

    // 获取新创建的 canvas
    const canvasId = `breakdown-${sectionName.replace(/\s+/g, '-')}`;
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) {
        console.error(`[renderSectionBreakdownChart] Error: Canvas #${canvasId} not found after creation.`);
        return;
    }

    const dataValues = [achievedScore, Math.max(0, maxScore - achievedScore)];
    const labels = ['已得分', '未得分'];
    const backgroundColors = [
        'rgba(25, 135, 84, 0.7)', // Success (已得分)
        'rgba(220, 53, 69, 0.5)'  // Danger-light (未得分)
    ];

    try {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: backgroundColors,
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%', // Make it thinner
                plugins: {
                    legend: {
                        display: false // Hide legend for small charts
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error(`[renderSectionBreakdownChart] Error creating chart for section ${sectionName}:`, error);
    }
}
// **** 结束新增函数 ****

// **** 新增：导出题库 ****
function exportQuestionBank() {
    try {
        const questionBank = JSON.parse(localStorage.getItem('questionBank') || '[]');
        if (questionBank.length === 0) {
            alert("题库为空，无需导出。");
            return;
        }
        const dataToExport = { questionBank: questionBank }; // Wrap in an object for consistency
        const jsonData = JSON.stringify(dataToExport, null, 2);
        downloadJsonFile(jsonData, 'question_bank');
        alert('题库数据已成功导出！');
    } catch (error) {
        console.error('导出题库时出错:', error);
        alert('导出题库失败，请查看控制台获取更多信息。');
    }
}

// **** 新增：导出测评历史 (已完成) ****
function exportCompletedHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
        const completedHistory = history.filter(record => record.status === 'completed');
        if (completedHistory.length === 0) {
            alert("没有已完成的测评历史记录可导出。");
            return;
        }
        const dataToExport = { assessmentHistory: completedHistory }; // Wrap in an object
        const jsonData = JSON.stringify(dataToExport, null, 2);
        downloadJsonFile(jsonData, 'assessment_history_completed');
        alert('已完成的测评历史已成功导出！');
    } catch (error) {
        console.error('导出测评历史时出错:', error);
        alert('导出测评历史失败，请查看控制台获取更多信息。');
    }
}

// **** 新增：导出暂存记录 ****
function exportPausedAssessments() {
    try {
        const history = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
        const pausedAssessments = history.filter(record => record.status === 'paused');
        if (pausedAssessments.length === 0) {
            alert("没有暂存的测评记录可导出。");
            return;
        }
        const dataToExport = { assessmentHistory: pausedAssessments }; // Wrap in an object
        const jsonData = JSON.stringify(dataToExport, null, 2);
        downloadJsonFile(jsonData, 'assessment_paused');
        alert('暂存的测评记录已成功导出！');
    } catch (error) {
        console.error('导出暂存记录时出错:', error);
        alert('导出暂存记录失败，请查看控制台获取更多信息。');
    }
}

// **** 新增：下载 JSON 文件的辅助函数 ****
function downloadJsonFile(jsonData, baseFilename) {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 14);
    a.download = `${baseFilename}_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// **** 修改：处理文件导入并合并数据 ****
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== 'application/json') {
        alert('请选择有效的 JSON 文件 (.json)');
        event.target.value = null; 
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // **** 智能判断导入类型 ****
            let dataType = 'unknown';
            let dataArray = null;

            if (importedData.questionBank && Array.isArray(importedData.questionBank)) {
                dataType = 'questionBank';
                dataArray = importedData.questionBank;
                 console.log("Detected imported data type: Question Bank");
            } else if (importedData.assessmentHistory && Array.isArray(importedData.assessmentHistory)) {
                // 进一步判断是历史记录还是暂存记录 (或混合)
                const firstRecord = importedData.assessmentHistory[0];
                if (firstRecord && firstRecord.status === 'paused') {
                    dataType = 'pausedAssessments';
                    console.log("Detected imported data type: Paused Assessments");
                } else if (firstRecord && firstRecord.status === 'completed'){
                    dataType = 'completedHistory';
                     console.log("Detected imported data type: Completed History");
                } else {
                     dataType = 'assessmentHistory'; // 可能是混合或旧格式
                     console.log("Detected imported data type: Assessment History (mixed/unknown status)");
                }
                dataArray = importedData.assessmentHistory;
            } else if (Array.isArray(importedData) && importedData.length > 0) {
                // 尝试猜测根级别数组的类型
                const firstItem = importedData[0];
                if (firstItem.content && firstItem.standardAnswer) {
                     dataType = 'questionBank_root'; // 根是题库数组
                     dataArray = importedData;
                     console.log("Detected imported data type: Question Bank (root array)");
                } else if (firstItem.userInfo && firstItem.answers) {
                     dataType = 'assessmentHistory_root'; // 根是历史数组
                     dataArray = importedData;
                     console.log("Detected imported data type: Assessment History (root array)");
                } else {
                     alert('无法识别导入文件中的数据结构。请确保文件是导出的题库或测评记录。');
                     event.target.value = null;
                     return;
                }
            } else {
                alert('导入的文件似乎不是有效的测评数据备份或格式不正确。请检查文件内容。');
                event.target.value = null;
                return;
            }

            // 确认导入操作 (根据检测到的类型)
            let confirmMessage = `检测到导入的数据类型为：${dataType}\n\n导入操作会将文件中的数据与现有数据合并。\n`;
            if (dataType.includes('questionBank')) {
                confirmMessage += "- 题库：将添加新题目，相同 ID 的题目将被覆盖。\n";
            } 
            if (dataType.includes('History') || dataType.includes('paused')) {
                 confirmMessage += "- 记录：将添加新记录，相同 ID 的记录将被覆盖。\n";
            }
            confirmMessage += "\n确定要继续吗？";

            if (!confirm(confirmMessage)) {
                event.target.value = null;
                return;
            }

            let newItemsAdded = 0;
            let itemsUpdated = 0;
            let targetStorageKey = '';

            // **** 执行合并 ****
            if (dataType.includes('questionBank')) {
                targetStorageKey = 'questionBank';
                const mergeResult = mergeDataById(targetStorageKey, dataArray);
                newItemsAdded = mergeResult.added;
                itemsUpdated = mergeResult.updated;
            } else if (dataType.includes('History') || dataType.includes('paused')) {
                targetStorageKey = 'assessmentHistory';
                const mergeResult = mergeDataById(targetStorageKey, dataArray);
                newItemsAdded = mergeResult.added;
                itemsUpdated = mergeResult.updated;
            } else {
                 // 不应该到这里
                 throw new Error("无法确定的数据类型，无法执行合并。");
            }
            
             // 重新计算岗位映射
             if (typeof updateAndSaveJobPositions === 'function') {
                 updateAndSaveJobPositions();
             } 

            alert(`数据导入并合并完成！ (${dataType})\n- 新增记录/题目：${newItemsAdded}\n- 更新记录/题目：${itemsUpdated}\n\n建议刷新页面或重新加载分析数据以查看更改。`);

            // 重新加载数据
            loadPositionList(); 
            loadEmployeeList();
            clearAnalysisDisplay();

        } catch (error) {
            console.error('导入数据时出错:', error);
            alert('导入数据失败，文件可能已损坏或格式不正确。请查看控制台获取更多信息。');
        } finally {
            event.target.value = null; // 清空文件选择
        }
    };
    reader.onerror = function(error) { console.error('读取文件时出错:', error); alert('读取文件失败。'); event.target.value = null; };
    reader.readAsText(file);
}

// **** 新增：通用的按 ID 合并数据的辅助函数 ****
function mergeDataById(storageKey, newDataArray) {
    let added = 0;
    let updated = 0;
    try {
        const existingDataJson = localStorage.getItem(storageKey);
        let existingData = existingDataJson ? JSON.parse(existingDataJson) : [];
        if (!Array.isArray(existingData)) existingData = []; // 确保是数组

        const existingDataMap = new Map(existingData.map(item => [item.id, item]));

        newDataArray.forEach(newItem => {
            if (newItem && newItem.id !== undefined) {
                if (existingDataMap.has(newItem.id)) {
                    // 更新
                    const index = existingData.findIndex(item => item.id === newItem.id);
                    if (index !== -1) {
                        existingData[index] = newItem;
                        updated++;
                    }
                } else {
                    // 新增
                    existingData.push(newItem);
                    added++;
                }
            }
        });
        localStorage.setItem(storageKey, JSON.stringify(existingData));
         console.log(`Merged data for key '${storageKey}'. Added: ${added}, Updated: ${updated}`);
    } catch (error) {
        console.error(`Error merging data for key ${storageKey}:`, error);
        throw error; // Re-throw error to be caught by the caller
    }
    return { added, updated };
}
