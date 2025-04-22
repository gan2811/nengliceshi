/**
 * 云函数：提交测评结果
 * 接收前端发送的测评数据包，并将其保存到 LeanCloud 数据库中。
 * @param {Object} request - 请求对象，包含传递的参数
 * @param {Object} request.params - 包含前端传递数据的对象
 * @param {Object} request.params.assessmentData - 包含测评详情的对象，结构类似前端的 currentAssessmentData
 * @returns {Promise<string>} - 成功时返回保存的 Assessment 对象的 objectId
 */
AV.Cloud.define('submitAssessmentCloud', async (request) => {
    const assessmentData = request.params.assessmentData;
    if (!assessmentData) {
        throw new AV.Cloud.Error('缺少必要的测评数据 (assessmentData)。', { code: 400 });
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
    const assessmentEndTime = assessmentData.timestamp ? new Date(assessmentData.timestamp) : new Date(); // 使用传递的时间戳或当前时间
    const startTime = assessmentData.startTime ? new Date(assessmentData.startTime) : null;
    const assessmentId = assessmentData.id; // 本地生成的 ID

    if (!userInfo || !userInfo.employeeId || !userInfo.name || !assessmentId || !assessorName) {
         throw new AV.Cloud.Error('测评数据中缺少关键信息 (userInfo, assessmentId, assessor)。', { code: 400 });
    }

    try {
        // --- 1. 获取或创建 UserProfile ---
        const userQuery = new AV.Query('UserProfile');
        const employeeIdNum = parseInt(userInfo.employeeId, 10);
        if (isNaN(employeeIdNum)) {
            throw new AV.Cloud.Error(`无效的 employeeId: ${userInfo.employeeId}`, { code: 400 });
        }
        userQuery.equalTo('employeeId', employeeIdNum);
        let userProfile = await userQuery.first();

        if (!userProfile) {
            console.log(`[submitAssessmentCloud] 未找到 UserProfile (employeeId: ${employeeIdNum})，创建新的...`);
            userProfile = new AV.Object('UserProfile');
            userProfile.set('employeeId', employeeIdNum);
            userProfile.set('name', userInfo.name);
            userProfile.set('stationCode', userInfo.station);
            userProfile.set('positionCode', userInfo.position);
            // 注意：云函数环境中默认权限可能不同，如有需要可在此设置 ACL
            // const acl = new AV.ACL();
            // acl.setPublicReadAccess(false); // 例如，禁止公共读取
            // acl.setWriteAccess(request.currentUser, true); // 允许当前用户写入 (如果需要用户登录)
            // userProfile.setACL(acl);
            userProfile = await userProfile.save(null, { useMasterKey: true }); // 在云函数中使用 Master Key 保存通常更方便，或确保执行者有权限
            console.log(`[submitAssessmentCloud] 新 UserProfile 已创建: ${userProfile.id}`);
        } else {
             console.log(`[submitAssessmentCloud] 找到存在的 UserProfile: ${userProfile.id}`);
        }

        // --- 2. 创建 Assessment 对象 ---
        console.log(`[submitAssessmentCloud] 准备创建 Assessment (assessmentId: ${assessmentId})...`);
        const Assessment = AV.Object.extend('Assessment');
        const assessment = new Assessment();
        // const assessmentACL = new AV.ACL(); // 设置所需权限
        // assessmentACL.setPublicReadAccess(false);
        // assessment.setACL(assessmentACL);
        assessment.set('assessmentId', assessmentId); // 保存本地生成的 ID
        assessment.set('userPointer', AV.Object.createWithoutData('UserProfile', userProfile.id));
        assessment.set('assessorName', assessorName);
        assessment.set('positionCode', assessmentData.position);
        assessment.set('startTime', startTime);
        assessment.set('endTime', assessmentEndTime);
        assessment.set('totalActiveSeconds', totalActiveSeconds);
        assessment.set('durationMinutes', Math.round(totalActiveSeconds / 60));
        assessment.set('status', 'completed'); // 云函数只处理最终提交
        assessment.set('totalScore', totalScore);
        assessment.set('maxPossibleScore', maxPossibleScore);
        assessment.set('scoreRate', scoreRate);

        const savedAssessment = await assessment.save(null, { useMasterKey: true }); // 使用 Master Key 或确保权限
        console.log(`[submitAssessmentCloud] Assessment 已保存: ${savedAssessment.id}`);

        // --- 3. 创建 AssessmentDetail 对象数组 ---
        console.log(`[submitAssessmentCloud] 准备创建 ${questions.length} 个 AssessmentDetail...`);
        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
        const detailObjects = [];
        // const detailACL = new AV.ACL(); // 设置所需权限
        // detailACL.setPublicReadAccess(false);

        questions.forEach(question => {
            const answer = answers[question.id];
            const detail = new AssessmentDetail();
            // detail.setACL(detailACL);
            detail.set('assessmentPointer', AV.Object.createWithoutData('Assessment', savedAssessment.id));
            detail.set('questionId', question.id);
            detail.set('questionContent', question.content);
            detail.set('standardScore', question.standardScore);
            detail.set('section', question.section);
            detail.set('type', question.type);
            detail.set('knowledgeSource', question.knowledgeSource);
            detail.set('score', answer?.score);
            detail.set('comment', answer?.comment || '');
            detail.set('durationSeconds', Number(answer?.duration || 0));
            detailObjects.push(detail);
        });

        // --- 4. 批量保存 AssessmentDetail 对象 ---
        if (detailObjects.length > 0) {
            await AV.Object.saveAll(detailObjects, { useMasterKey: true }); // 使用 Master Key 或确保权限
            console.log(`[submitAssessmentCloud] ${detailObjects.length} 个 AssessmentDetails 已保存。`);
        }

        console.log(`[submitAssessmentCloud] 测评 (assessmentId: ${assessmentId}) 成功保存到云端。`);
        // 返回保存的 Assessment 的 objectId
        return savedAssessment.id;

    } catch (error) {
        console.error(`[submitAssessmentCloud] 处理测评 (assessmentId: ${assessmentId}) 时出错:`, error);
        // 将错误包装成 AV.Cloud.Error 以便前端能接收到结构化的错误信息
        throw new AV.Cloud.Error(error.message || '保存测评时发生未知错误。', {
            code: error.code || 500, // 使用原始错误码或默认为 500
            details: error // 可以包含原始错误对象
        });
    }
});

// 你可以在此文件后面添加更多的云函数定义
// 例如： AV.Cloud.define('getAssessmentHistory', async (request) => { ... }); 