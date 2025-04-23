// cloud/main.js

// 确保包含了 leanengine 模块
const AV = require('leanengine');

/**
 * 云函数：提交测评结果 (兼容 Node.js v8 版本)
 * 接收前端发送的测评数据包，并将其保存到 LeanCloud 数据库中。
 * @param {Object} request - 请求对象，包含传递的参数
 * @param {Object} request.params - 包含前端传递数据的对象
 * @param {Object} request.params.assessmentData - 包含测评详情的对象，结构类似前端的 currentAssessmentData
 * @returns {Promise<string>} - 成功时返回保存的 Assessment 对象的 objectId
 */
AV.Cloud.define('submitAssessmentCloud', async (request) => {
    // 打印日志确认函数开始执行
    console.log("[submitAssessmentCloud] Received request. Function starting...");

    const assessmentData = request.params.assessmentData;
    if (!assessmentData) {
        console.error("[submitAssessmentCloud] Error: Missing assessmentData in request parameters.");
        throw new AV.Cloud.Error('缺少必要的测评数据 (assessmentData)。', { code: 400 });
    }

    // 尝试打印传入的数据用于调试
    try {
        console.log("[submitAssessmentCloud] Received assessmentData preview:", JSON.stringify(assessmentData).substring(0, 500) + "..."); // 打印部分预览，避免过长
    } catch(e) {
        console.warn("[submitAssessmentCloud] Could not stringify assessmentData for logging preview:", e.message);
    }

    // 从传递的数据中获取必要信息
    const userInfo = assessmentData.userInfo;
    const assessorName = assessmentData.assessor;
    const questions = assessmentData.questions;
    const answers = assessmentData.answers;
    const totalScore = assessmentData.score;
    const maxPossibleScore = assessmentData.maxScore;
    const scoreRate = assessmentData.scoreRate;
    const totalActiveSeconds = assessmentData.totalActiveSeconds || 0;
    const assessmentEndTime = assessmentData.timestamp ? new Date(assessmentData.timestamp) : new Date();
    const startTime = assessmentData.startTime ? new Date(assessmentData.startTime) : null;
    const assessmentId = assessmentData.id;

    // 增强数据校验 (兼容旧版 Node.js)
    const hasUserInfo = !!userInfo;
    const hasEmployeeId = hasUserInfo && !!userInfo.employeeId;
    const hasName = hasUserInfo && !!userInfo.name;
    if (!hasUserInfo || !hasEmployeeId || !hasName || !assessmentId || !assessorName || !questions || !answers) {
         console.error("[submitAssessmentCloud] Error: Missing critical info in assessmentData:", { hasUserInfo: hasUserInfo, hasEmployeeId: hasEmployeeId, hasName: hasName, hasAssessmentId: !!assessmentId, hasAssessor: !!assessorName, hasQuestions: !!questions, hasAnswers: !!answers });
         throw new AV.Cloud.Error('测评数据中缺少关键信息 (如用户信息, assessmentId, assessor, questions, answers)。', { code: 400 });
    }

    try {
        // --- 1. 获取或创建 UserProfile ---
        console.log("[submitAssessmentCloud] Step 1: Getting or creating UserProfile...");
        const userQuery = new AV.Query('UserProfile');
        const employeeIdNum = parseInt(userInfo.employeeId, 10);
        if (isNaN(employeeIdNum)) {
            console.error(`[submitAssessmentCloud] Error: Invalid employeeId format: ${userInfo.employeeId}`);
            throw new AV.Cloud.Error(`无效的 employeeId: ${userInfo.employeeId}`, { code: 400 });
        }
        userQuery.equalTo('employeeId', employeeIdNum);
        let userProfile = await userQuery.first();

        if (!userProfile) {
            console.log(`[submitAssessmentCloud] UserProfile not found (employeeId: ${employeeIdNum}), creating new...`);
            userProfile = new AV.Object('UserProfile');
            userProfile.set('employeeId', employeeIdNum);
            userProfile.set('name', userInfo.name);
            userProfile.set('stationCode', userInfo.station);
            userProfile.set('positionCode', userInfo.position);
            // 使用 Master Key 保存以忽略 ACL 限制
            userProfile = await userProfile.save(null, { useMasterKey: true });
            console.log(`[submitAssessmentCloud] New UserProfile created: ${userProfile.id}`);
        } else {
             console.log(`[submitAssessmentCloud] Existing UserProfile found: ${userProfile.id}`);
        }

        // --- 2. 创建 Assessment 对象 ---
        console.log(`[submitAssessmentCloud] Step 2: Creating Assessment object (assessmentId: ${assessmentId})...`);
        const Assessment = AV.Object.extend('Assessment');
        const assessment = new Assessment();
        assessment.set('assessmentId', assessmentId);
        assessment.set('userPointer', AV.Object.createWithoutData('UserProfile', userProfile.id));
        assessment.set('assessorName', assessorName);
        assessment.set('positionCode', assessmentData.position);
        assessment.set('startTime', startTime);
        assessment.set('endTime', assessmentEndTime);
        assessment.set('totalActiveSeconds', totalActiveSeconds);
        assessment.set('durationMinutes', Math.round(totalActiveSeconds / 60));
        assessment.set('status', 'completed');
        assessment.set('totalScore', totalScore);
        assessment.set('maxPossibleScore', maxPossibleScore);
        assessment.set('scoreRate', scoreRate);

        const savedAssessment = await assessment.save(null, { useMasterKey: true });
        console.log(`[submitAssessmentCloud] Assessment saved: ${savedAssessment.id}`);

        // --- 3. 创建 AssessmentDetail 对象数组 ---
        console.log(`[submitAssessmentCloud] Step 3: Preparing ${Array.isArray(questions) ? questions.length : 0} AssessmentDetail objects...`);
        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
        const detailObjects = [];

        if (Array.isArray(questions)) {
            questions.forEach(question => {
                if (!question || typeof question !== 'object' || !question.id) {
                    console.warn("[submitAssessmentCloud] Skipping invalid question object:", question);
                    return;
                }
                const answer = answers[question.id]; // 获取对应答案，可能为 undefined
                const detail = new AssessmentDetail();

                detail.set('assessmentPointer', AV.Object.createWithoutData('Assessment', savedAssessment.id));
                detail.set('questionId', question.id);
                detail.set('questionContent', question.content);
                detail.set('standardScore', question.standardScore);
                detail.set('section', question.section);
                detail.set('type', question.type);
                detail.set('knowledgeSource', question.knowledgeSource);
                // 兼容旧版 Node.js 的写法
                detail.set('score', answer && answer.score !== undefined && answer.score !== null ? answer.score : null); // 处理 null
                detail.set('comment', answer && answer.comment ? answer.comment : '');
                detail.set('durationSeconds', Number(answer && answer.duration !== undefined && answer.duration !== null ? answer.duration : 0)); // 确保是数字

                detailObjects.push(detail);
            });
        } else {
            console.error("[submitAssessmentCloud] Error: assessmentData.questions is not an array!");
        }

        // --- 4. 批量保存 AssessmentDetail 对象 ---
        if (detailObjects.length > 0) {
            console.log(`[submitAssessmentCloud] Step 4: Saving ${detailObjects.length} AssessmentDetail objects...`);
            await AV.Object.saveAll(detailObjects, { useMasterKey: true });
            console.log(`[submitAssessmentCloud] ${detailObjects.length} AssessmentDetails saved.`);
        } else {
             console.log(`[submitAssessmentCloud] Step 4: No valid AssessmentDetail objects to save.`);
        }

        console.log(`[submitAssessmentCloud] Assessment processing completed successfully for assessmentId: ${assessmentId}.`);
        return savedAssessment.id; // 返回成功保存的 Assessment 的 objectId

    } catch (error) {
        console.error(`[submitAssessmentCloud] Error processing assessment (assessmentId: ${assessmentId}):`, error);
        // 改进错误抛出，包含堆栈信息
        const cloudError = new AV.Cloud.Error(error.message || '保存测评时发生未知错误。', {
            code: error.code || 500
        });
        // 尝试附加堆栈信息，如果存在的话
        if (error.stack) {
            cloudError.details = { stack: error.stack };
        }
        throw cloudError;
    }
});

// **** 新增：处理暂停测评的云函数 ****
AV.Cloud.define('pauseAssessmentCloud', async (request) => {
    console.log('[pauseAssessmentCloud] Function started.');
    const { assessmentData } = request.params;
    const user = request.currentUser; // Get current logged-in user (if applicable)

    // --- 基本验证 ---
    if (!assessmentData) {
        throw new AV.Cloud.Error('Missing assessmentData parameter.', { code: 400 });
    }
    if (!assessmentData.id) {
        throw new AV.Cloud.Error('Assessment data must have an ID.', { code: 400 });
    }
    console.log(`[pauseAssessmentCloud] Processing assessment ID: ${assessmentData.id}`);

    const assessmentId = String(assessmentData.id); // Ensure ID is a string

    try {
        // --- 1. 准备 Assessment 对象数据 ---
        console.log('[pauseAssessmentCloud] Step 1: Preparing Assessment object data...');
        const Assessment = AV.Object.extend('Assessment');
        // 尝试获取已存在的记录，以便更新而不是创建新的
        let assessment;
        try {
            const query = new AV.Query('Assessment');
            // 注意：这里使用 LeanCloud 的 objectId 进行查询，而不是我们自定义的 id
            // 如果我们希望用自定义的 assessmentData.id 作为唯一标识符来查找和更新，需要调整查询逻辑
            // 假设我们是根据前端生成的 id (时间戳) 来查找或创建
            // 我们需要一个字段来存储这个前端ID，比如 'frontendId'
            // 或者，如果前端总是传递 LeanCloud 的 objectId（在恢复后暂停），则可以用 get

            // **** 策略调整：使用 frontendId 作为查找/创建依据 ****
            // 我们需要在 Assessment 表中添加一个 'frontendId' 字段来存储 assessmentData.id
            query.equalTo('frontendId', assessmentId);
            assessment = await query.first({ useMasterKey: true });

            if (!assessment) {
                console.log(`[pauseAssessmentCloud] No existing assessment found for frontendId ${assessmentId}. Creating new record.`);
                assessment = new Assessment();
                assessment.set('frontendId', assessmentId); // 设置前端ID
            } else {
                console.log(`[pauseAssessmentCloud] Found existing assessment ${assessment.id} for frontendId ${assessmentId}. Updating.`);
            }
        } catch (findError) {
             console.error(`[pauseAssessmentCloud] Error finding assessment for frontendId ${assessmentId}, creating new one. Error:`, findError);
             assessment = new Assessment();
             assessment.set('frontendId', assessmentId);
        }

        // --- 填充或更新 Assessment 数据 ---
        // 用户信息
        if (assessmentData.userInfo) {
            const User = AV.Object.extend('_User');
            const userPointer = User.createWithoutData(assessmentData.userInfo.objectId || user?.id);
            assessment.set('userPointer', userPointer);
            assessment.set('userName', assessmentData.userInfo.name);
            assessment.set('userEmployeeId', assessmentData.userInfo.employeeId);
            assessment.set('userDepartment', assessmentData.userInfo.department);
            assessment.set('userStation', assessmentData.userInfo.station);
        }
        // 岗位信息
        if (assessmentData.position) {
            assessment.set('positionCode', assessmentData.position);
            // TODO: Consider fetching/setting positionName if needed/available
        }
        // 时间信息
        assessment.set('startTime', assessmentData.startTime ? new Date(assessmentData.startTime) : null);
        assessment.set('timestamp', assessmentData.timestamp ? new Date(assessmentData.timestamp) : new Date()); // Pause time
        assessment.set('totalActiveSeconds', Number(assessmentData.totalActiveSeconds) || 0);
        assessment.set('elapsedSeconds', Number(assessmentData.elapsedSeconds) || 0); // Total time elapsed since start
        // 暂停时 durationMinutes 可以不计算或按活动时间计算
        assessment.set('durationMinutes', Math.round((Number(assessmentData.totalActiveSeconds) || 0) / 60));

        // 状态信息 (关键)
        assessment.set('status', 'paused'); // 设置状态为 paused
        assessment.set('currentQuestionIndex', Number(assessmentData.currentQuestionIndex) || 0);
        assessment.set('assessorName', assessmentData.assessor || null);

        // 清除可能存在的旧的完成信息 (如果从已完成状态再次暂停，虽然不常见)
        assessment.unset('score');
        assessment.unset('maxScore');
        assessment.unset('scoreRate');
        assessment.unset('endTime');
        // 显式设置 totalScore 等为 null
        assessment.set('totalScore', null);
        assessment.set('maxPossibleScore', assessmentData.maxScore || null); // 可能需要保留最大分值
        assessment.set('scoreRate', null);

        // --- 2. 保存 Assessment 对象 ---
        console.log('[pauseAssessmentCloud] Step 2: Saving Assessment object...');
        const savedAssessment = await assessment.save(null, { useMasterKey: true });
        const savedAssessmentId = savedAssessment.id;
        console.log(`[pauseAssessmentCloud] Assessment saved/updated: ${savedAssessmentId}`);

        // --- 3. 准备 AssessmentDetail 对象数据 ---
        console.log('[pauseAssessmentCloud] Step 3: Preparing AssessmentDetail objects...');
        const questions = assessmentData.questions || [];
        const answers = assessmentData.answers || {};
        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
        const detailObjectsToSave = [];
        const existingDetailsMap = new Map();

        // 如果是更新，先查询已有的 Detail 记录
        if (assessment.existed()) {
            const detailQuery = new AV.Query('AssessmentDetail');
            detailQuery.equalTo('assessmentPointer', savedAssessment);
            detailQuery.limit(1000); // Assume less than 1000 questions
            const existingDetails = await detailQuery.find({ useMasterKey: true });
            existingDetails.forEach(detail => {
                // 使用 questionId 作为 key 来快速查找
                const qId = detail.get('questionId');
                if(qId) {
                    existingDetailsMap.set(qId, detail);
                }
            });
             console.log(`[pauseAssessmentCloud] Found ${existingDetailsMap.size} existing details for assessment ${savedAssessmentId}.`);
        }

        for (const question of questions) {
            const questionId = String(question.id);
            const answer = answers[questionId] || {};
            let detailObject = existingDetailsMap.get(questionId);

            if (!detailObject) {
                // 如果找不到旧的，创建新的
                detailObject = new AssessmentDetail();
                detailObject.set('assessmentPointer', savedAssessment); // Link to the main assessment
                detailObject.set('questionId', questionId);
            } else {
                 console.log(`[pauseAssessmentCloud] Updating existing detail for questionId ${questionId}.`);
            }

            // 更新或设置 Detail 数据
            detailObject.set('questionContent', question.content || '');
            detailObject.set('standardScore', question.standardScore !== undefined ? question.standardScore : null);
            detailObject.set('score', answer.score !== undefined ? answer.score : null);
            detailObject.set('comment', answer.comment || '');
            detailObject.set('durationSeconds', Number(answer.duration) || 0);
            detailObject.set('startTime', answer.startTime ? new Date(answer.startTime) : null);
            detailObject.set('knowledgeSource', question.knowledgeSource || null);
            detailObject.set('standardAnswer', question.standardAnswer || null);
            detailObject.set('section', question.section || null);
            detailObject.set('type', question.type || null);

            detailObjectsToSave.push(detailObject);
        }

        // --- 4. 批量保存 AssessmentDetail 对象 ---
        if (detailObjectsToSave.length > 0) {
            console.log(`[pauseAssessmentCloud] Step 4: Saving ${detailObjectsToSave.length} AssessmentDetail objects...`);
            await AV.Object.saveAll(detailObjectsToSave, { useMasterKey: true });
            console.log(`[pauseAssessmentCloud] ${detailObjectsToSave.length} AssessmentDetails saved/updated.`);
        } else {
            console.log('[pauseAssessmentCloud] Step 4: No AssessmentDetail objects to save.');
        }

        console.log(`[pauseAssessmentCloud] Assessment pause processing completed for frontendId: ${assessmentId}, cloud ObjectId: ${savedAssessmentId}.`);
        return savedAssessmentId; // 返回 Assessment 的 objectId

    } catch (error) {
        console.error(`[pauseAssessmentCloud] Error processing pause for assessment frontendId ${assessmentId}:`, error);
        throw new AV.Cloud.Error(error.message || '保存暂停状态时发生未知错误。', {
            code: error.code || 500,
            details: error.stack
        });
    }
});

// 获取岗位列表 (示例，具体实现可能不同)
AV.Cloud.define('getPositions', async (request) => {
// ... existing code ...
});

// 如果你还有其他的云函数或 Hook，应该也定义在这个文件里
// 例如: AV.Cloud.define('anotherFunction', ...);
// 例如: AV.Cloud.afterSave('SomeClass', ...); 