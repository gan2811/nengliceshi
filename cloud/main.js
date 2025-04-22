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

// 如果你还有其他的云函数或 Hook，应该也定义在这个文件里
// 例如: AV.Cloud.define('anotherFunction', ...);
// 例如: AV.Cloud.afterSave('SomeClass', ...); 