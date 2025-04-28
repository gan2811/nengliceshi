// cloud/main.js

// 确保包含了 leanengine 模块
const AV = require('leanengine');

// --- Helper Functions ---

// Finds UserProfile object by employeeId, creates if not found
async function findUserProfileByEmployeeId(employeeId, employeeName) {
    if (!employeeId) {
        throw new Error("必须提供被测评人ID (employeeId)。");
    }
    const profileQuery = new AV.Query('UserProfile');
    const employeeIdNum = parseInt(employeeId, 10);
    if (isNaN(employeeIdNum)) {
         // If the input ID is not a number, we cannot match or create with Number type
         throw new Error(`提供的工号 "${employeeId}" 不是有效的数字格式。`);
    }
    profileQuery.equalTo('employeeId', employeeIdNum); // Query using the Number

    const profiles = await profileQuery.find({ useMasterKey: true });

    if (profiles.length === 0) {
        console.log(`未找到工号为 "${employeeIdNum}" 的用户配置，将尝试创建新记录...`);
        if (!employeeName) {
             throw new Error(`无法创建新用户配置：未提供工号 "${employeeIdNum}" 对应的姓名。`);
        }
        // **** Convert employeeId to Number before setting ****
        const employeeIdToSave = employeeIdNum; // Already converted and validated

        const NewUserProfile = AV.Object.extend('UserProfile');
        const newProfile = new NewUserProfile();
        newProfile.set('employeeId', employeeIdToSave); // **** Set the Number type ****
        newProfile.set('name', employeeName);     // Set the name
        // Add any other default fields if necessary
        try {
            const savedProfile = await newProfile.save(null, { useMasterKey: true });
            console.log(`成功创建并保存了新的 UserProfile 记录: ${savedProfile.id}`);
            return savedProfile; // Return the newly created profile
        } catch (saveError) {
            console.error(`创建 UserProfile (工号: ${employeeIdToSave}) 失败:`, saveError);
            // If creation failed (e.g., unique constraint violation), try finding again briefly?
            // For simplicity, just rethrow for now.
            throw new Error(`创建工号为 "${employeeIdToSave}" 的用户配置失败: ${saveError.message}`);
        }
    } else if (profiles.length > 1) {
        console.warn(`找到多个工号为 "${employeeIdNum}" 的用户配置，将使用第一个。`);
        // Consider erroring out if duplicates are problematic
    }
    // Return the first found profile
    return profiles[0];
}

// Finds Station object by stationCode, creates if not found
async function findStationByCode(stationCode, stationName) {
    if (!stationCode) {
        console.warn("未提供站点代码 (stationCode)，无法查找或创建。");
        return null;
    }
    const stationQuery = new AV.Query('Station');
    stationQuery.equalTo('stationCode', stationCode);
    const stations = await stationQuery.find({ useMasterKey: true });

    if (stations.length === 0) {
        console.log(`未找到代码为 "${stationCode}" 的站点，将尝试创建新记录...`);
        if (!stationName) {
             throw new Error(`无法创建新站点：未提供代码 "${stationCode}" 对应的名称。`);
        }
        // **** Create new Station ****
        const NewStation = AV.Object.extend('Station');
        const newStation = new NewStation();
        newStation.set('stationCode', stationCode);
        newStation.set('stationName', stationName);
        try {
            const savedStation = await newStation.save(null, { useMasterKey: true });
            console.log(`成功创建并保存了新的 Station 记录: ${savedStation.id}`);
            return savedStation;
        } catch (saveError) {
            console.error(`创建 Station (代码: ${stationCode}) 失败:`, saveError);
            throw new Error(`创建代码为 "${stationCode}" 的站点失败: ${saveError.message}`);
        }
    } else if (stations.length > 1) {
         console.warn(`找到多个代码为 "${stationCode}" 的站点，将使用第一个。`);
    }
    return stations[0];
}

// Finds Position object by positionCode, creates if not found
async function findPositionByCode(positionCode, positionName) {
    if (!positionCode) {
        console.warn("未提供岗位代码 (positionCode)，无法查找或创建。");
        return null;
    }
    const positionQuery = new AV.Query('Position');
    positionQuery.equalTo('positionCode', positionCode);
    const positions = await positionQuery.find({ useMasterKey: true });

    if (positions.length === 0) {
        console.log(`未找到代码为 "${positionCode}" 的岗位，将尝试创建新记录...`);
        if (!positionName) {
             throw new Error(`无法创建新岗位：未提供代码 "${positionCode}" 对应的名称。`);
        }
        // **** Create new Position ****
        const NewPosition = AV.Object.extend('Position');
        const newPosition = new NewPosition();
        newPosition.set('positionCode', positionCode);
        newPosition.set('positionName', positionName);
        try {
            const savedPosition = await newPosition.save(null, { useMasterKey: true });
            console.log(`成功创建并保存了新的 Position 记录: ${savedPosition.id}`);
            return savedPosition;
        } catch (saveError) {
            console.error(`创建 Position (代码: ${positionCode}) 失败:`, saveError);
            throw new Error(`创建代码为 "${positionCode}" 的岗位失败: ${saveError.message}`);
        }
    } else if (positions.length > 1) {
         console.warn(`找到多个代码为 "${positionCode}" 的岗位，将使用第一个。`);
    }
    return positions[0];
}

/**
 * 云函数：提交测评结果 (兼容 Node.js v8 版本)
 * 接收前端发送的测评数据包，并将其保存到 LeanCloud 数据库中。
 * @param {Object} request - 请求对象，包含传递的参数
 * @param {Object} request.params - 包含前端传递数据的对象
 * @param {Object} request.params.assessmentData - 包含测评详情的对象，结构类似前端的 currentAssessmentData
 * @returns {Promise<string>} - 成功时返回保存的 Assessment 对象的 objectId
 */
AV.Cloud.define('submitAssessmentCloud', async (request) => {
    console.log("[submitAssessmentCloud] Received request. Function starting...");
    // **** 1. 身份验证 ****
    const user = request.currentUser;
    if (!user) {
        throw new AV.Cloud.Error('用户未登录，无法提交测评。', { code: 401 }); // 401 Unauthorized
    }
    console.log(`[submitAssessmentCloud] User authenticated: ${user.id}`);

    const { assessmentData, assessmentObjectId } = request.params;

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
    const assesseeEmployeeId = assessmentData.employeeId;
    const assesseeEmployeeName = assessmentData.employeeName;
    const assessorName = assessmentData.assessor;
    const questions = assessmentData.questions;
    const answers = assessmentData.answers;
    const totalScore = assessmentData.score;
    const maxPossibleScore = assessmentData.maxScore;
    const scoreRate = assessmentData.scoreRate;
    const totalActiveSeconds = assessmentData.totalActiveSeconds || 0;
    const assessmentEndTime = assessmentData.timestamp ? new Date(assessmentData.timestamp) : new Date();
    const startTime = assessmentData.startTime ? new Date(assessmentData.startTime) : null;
    const assessmentIdFromData = assessmentData.assessmentId;
    const stationCode = assessmentData.stationCode;
    const stationName = assessmentData.stationName;
    const positionCode = assessmentData.positionCode;
    const positionName = assessmentData.positionName;

    // 增强数据校验 (兼容旧版 Node.js)
    const hasEmployeeId = !!assesseeEmployeeId;
    const hasName = !!assesseeEmployeeName;
    if (!hasEmployeeId || !hasName || !assessmentIdFromData || !assessorName || !questions || !answers) {
         console.error("[submitAssessmentCloud] Error: Missing critical info in assessmentData:", { hasEmployeeId: hasEmployeeId, hasName: hasName, hasAssessmentId: !!assessmentIdFromData, hasAssessor: !!assessorName, hasQuestions: !!questions, hasAnswers: !!answers });
         throw new AV.Cloud.Error('测评数据中缺少关键信息 (如员工信息, assessmentId, assessor, questions, answers)。', { code: 400 });
    }

    // **** Add validation for names if creation is possible ****
    if (!stationCode || !stationName || !positionCode || !positionName) {
         throw new AV.Cloud.Error('提交失败：缺少站点或岗位代码/名称。', { code: 400 });
    }

    try {
        // --- Find Assessee User Profile --- (Correct step)
        console.log(`[submitAssessmentCloud] Finding/Creating UserProfile for assesseeEmployeeId: ${assesseeEmployeeId}...`);
        const assesseeUserProfile = await findUserProfileByEmployeeId(assesseeEmployeeId, assesseeEmployeeName);
        console.log(`[submitAssessmentCloud] Using UserProfile for assessee: ${assesseeUserProfile.id}`);

        // **** Find Station and Position Objects ****
        const stationObject = await findStationByCode(stationCode, stationName);
        const positionObject = await findPositionByCode(positionCode, positionName);
        // Add checks if station/position are mandatory
        if (!stationObject) throw new Error("提交失败：无效的站点代码。");
        if (!positionObject) throw new Error("提交失败：无效的岗位代码。");

        // **** 新增：在处理 Assessment 之前，更新 UserProfile ****
        try {
            console.log(`[submitAssessmentCloud] Updating UserProfile ${assesseeUserProfile.id} with station/position pointers...`);
            assesseeUserProfile.set('stationPointer', stationObject);
            assesseeUserProfile.set('positionPointer', positionObject);
            await assesseeUserProfile.save(null, { useMasterKey: true });
            console.log(`[submitAssessmentCloud] UserProfile ${assesseeUserProfile.id} updated successfully.`);
        } catch (profileSaveError) {
            console.error(`[submitAssessmentCloud] Error updating UserProfile ${assesseeUserProfile.id}:`, profileSaveError);
            // 根据策略决定是否继续，这里选择抛出错误阻止继续
            throw new AV.Cloud.Error(`更新用户信息时出错: ${profileSaveError.message}`, { code: 500 });
        }

        // --- 2. **修改：查找或创建 Assessment 对象，并验证权限** ---
        console.log(`[submitAssessmentCloud] Step 2: Finding/creating Assessment (objectId: ${assessmentObjectId})...`);
        const Assessment = AV.Object.extend('Assessment');
        let assessment;

        if (assessmentObjectId) {
            // 如果前端传递了 objectId (意味着是之前暂停或保存过的)
            try {
                const query = new AV.Query('Assessment');
                assessment = await query.get(assessmentObjectId, { useMasterKey: true });
                console.log(`[submitAssessmentCloud] Found existing assessment by objectId: ${assessment.id}`);

                // **** 权限检查 ****
                const owner = assessment.get('owner');
                if (!owner || owner.id !== user.id) {
                    console.error(`[submitAssessmentCloud] Permission denied: User ${user.id} tried to submit assessment ${assessment.id} owned by ${owner?.id}`);
                    throw new AV.Cloud.Error('您没有权限提交此测评记录。', { code: 403 }); // 403 Forbidden
                }
                console.log(`[submitAssessmentCloud] Ownership verified for user ${user.id}.`);
                assessment.set('status', 'completed'); // 更新状态

            } catch (error) {
                // 如果 get 失败 (例如 ID 无效或记录不存在)
                console.error(`[submitAssessmentCloud] Error fetching assessment with objectId ${assessmentObjectId}:`, error);
                throw new AV.Cloud.Error('找不到要提交的测评记录或获取时出错。', { code: 404 }); // 404 Not Found or other error
            }
        } else {
            // 如果没有 objectId (意味着是第一次提交，之前未暂停)
            console.log(`[submitAssessmentCloud] No objectId provided. Creating new assessment.`);
            assessment = new Assessment();
            // **** 设置负责人 ****
            assessment.set('owner', user);
            assessment.set('status', 'completed');
            // 设置 assessmentId (前端 ID，如果需要)
            let assessmentIdNumForSet;
            try {
                assessmentIdNumForSet = parseInt(assessmentIdFromData, 10);
                if (isNaN(assessmentIdNumForSet)) throw new Error();
            assessment.set('assessmentId', assessmentIdNumForSet);
            } catch (e) { /* 忽略或记录警告 */ console.warn(`Invalid assessmentId format: ${assessmentIdFromData}`); }
        }

        // --- 统一设置/更新其他字段 ---
        // 使用 userProfile (如果获取成功) 或 user 对象填充信息
        assessment.set('userPointer', assesseeUserProfile);
        assessment.set('assessorName', assessorName);
        assessment.set('startTime', startTime);
        assessment.set('endTime', assessmentEndTime);
        assessment.set('totalActiveSeconds', totalActiveSeconds);
        assessment.set('durationMinutes', Math.round((totalActiveSeconds || 0) / 60));
        assessment.set('totalScore', totalScore);
        assessment.set('maxPossibleScore', maxPossibleScore);
        assessment.set('scoreRate', scoreRate);
        assessment.unset('elapsedSeconds');
        assessment.unset('currentQuestionIndex');

        // **** 新增：为 Assessment 设置 ACL ****
        console.log('[submitAssessmentCloud] Setting ACL for Assessment...'); // 添加日志方便调试
        const assessmentAcl = new AV.ACL();
        const adminRole = new AV.Role('Admin'); // 获取 Admin 角色

        assessmentAcl.setPublicReadAccess(false);
        assessmentAcl.setPublicWriteAccess(false);

        // 授予 Admin 角色读写权限
        assessmentAcl.setRoleReadAccess(adminRole, true);
        assessmentAcl.setRoleWriteAccess(adminRole, true);

        // 授予被测评用户读取权限
        if (assesseeUserProfile) { // 使用前面获取的 assesseeUserProfile
            assessmentAcl.setReadAccess(assesseeUserProfile, true);
            // 如果被测评用户也需要写权限（例如暂停/恢复），取消下面一行的注释
            // assessmentAcl.setWriteAccess(assesseeUserProfile, true);
        } else {
            console.warn('[submitAssessmentCloud] Assessment is missing userPointer (assesseeUserProfile), cannot grant read access to the tested user.');
        }

        // 可选：授予测评师（调用者）读写权限
        if (user) { // 使用函数开头的 user 变量
            assessmentAcl.setReadAccess(user, true);
            assessmentAcl.setWriteAccess(user, true);
            console.log(`[submitAssessmentCloud] Granting Read/Write access to caller: ${user.id}`);
        } else {
            console.warn('[submitAssessmentCloud] request.currentUser (user) is not available, cannot grant access to caller.');
        }

        assessment.setACL(assessmentAcl); // 应用 ACL
        console.log('[submitAssessmentCloud] ACL set for Assessment object.');
        // **** 结束 ACL 设置 ****

        const savedAssessment = await assessment.save(null, { useMasterKey: true });
        console.log(`[submitAssessmentCloud] Assessment saved/updated: ${savedAssessment.id}`);

        // --- 处理 AssessmentDetail (逻辑基本不变，但要用 savedAssessment) ---
        console.log(`[submitAssessmentCloud] Step 3: Preparing AssessmentDetail objects...`);
        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
        const detailObjectsToSave = [];
        const existingDetailsMap = new Map();
        if (assessmentObjectId) { // 只有更新时才需要查旧的
            const detailQuery = new AV.Query('AssessmentDetail');
            detailQuery.equalTo('assessmentPointer', savedAssessment); 
            detailQuery.limit(1000);
            const existingDetails = await detailQuery.find({ useMasterKey: true });
            existingDetails.forEach(detail => {
                const qId = detail.get('questionId');
                if (qId !== undefined) existingDetailsMap.set(qId, detail);
            });
            console.log(`[submitAssessmentCloud] Found ${existingDetailsMap.size} existing details.`);
        }
        const finalQuestions = assessmentData.questions || [];
        const finalAnswers = assessmentData.answers || {};
        for (const question of finalQuestions) {
                let questionIdNum;
                try {
                    questionIdNum = parseInt(question.id, 10);
                 if (isNaN(questionIdNum)) continue;
             } catch (e) { continue; }

             let detailObject = existingDetailsMap.get(questionIdNum);
             if (!detailObject) {
                    detailObject = new AssessmentDetail();
                    detailObject.set('assessmentPointer', savedAssessment);
                    detailObject.set('questionId', questionIdNum);
             } // else { console.log(`Updating detail for qId ${questionIdNum}`); }

                detailObject.set('questionContent', question.content);
                detailObject.set('standardScore', question.standardScore);
                detailObject.set('section', question.section);
                detailObject.set('type', question.type);
                detailObject.set('knowledgeSource', question.knowledgeSource);
             const answer = finalAnswers[questionIdNum];
             detailObject.set('score', answer?.score ?? null);
             detailObject.set('comment', answer?.comment ?? '');
             detailObject.set('durationSeconds', Number(answer?.duration ?? 0));
             // **** 保存 startTime ****
             detailObject.set('startTime', answer && answer.startTime ? new Date(answer.startTime) : null);

            // **** 新增：为 AssessmentDetail 设置 ACL (通常与 Assessment 一致) ****
            console.log(`[submitAssessmentCloud] Setting ACL for Detail (QID: ${questionIdNum})...`); // 添加日志
            const detailAcl = new AV.ACL();
            // adminRole 已经定义过，可以直接使用

            detailAcl.setPublicReadAccess(false);
            detailAcl.setPublicWriteAccess(false);

            // 授予 Admin 角色读写权限
            detailAcl.setRoleReadAccess(adminRole, true);
            detailAcl.setRoleWriteAccess(adminRole, true);

            // 授予被测评用户读取权限
            if (assesseeUserProfile) { // 使用 assesseeUserProfile
                detailAcl.setReadAccess(assesseeUserProfile, true);
            }

            // 可选：授予测评师（调用者）读写权限
            if (user) { // 使用 user 变量
                detailAcl.setReadAccess(user, true);
                detailAcl.setWriteAccess(user, true);
            }

            detailObject.setACL(detailAcl); // 应用 ACL
            // **** 结束 ACL 设置 ****

            detailObjectsToSave.push(detailObject);
        }
        if (detailObjectsToSave.length > 0) {
            console.log(`[submitAssessmentCloud] Step 4: Saving/Updating ${detailObjectsToSave.length} AssessmentDetail objects...`);
            await AV.Object.saveAll(detailObjectsToSave, { useMasterKey: true });
        }

        console.log(`[submitAssessmentCloud] Processing completed for assessment: ${savedAssessment.id}.`);
        // **** 返回 objectId ****
        return savedAssessment.id;

    } catch (error) {
        console.error(`[submitAssessmentCloud] Error processing assessment (objectId: ${assessmentObjectId}):`, error);
        // 保持之前的错误抛出逻辑
        const cloudError = new AV.Cloud.Error(error.message || '保存测评时发生未知错误。', {
            code: error.code || (error instanceof AV.Cloud.Error ? 400 : 500) // 更智能的错误码
        });
        if (error.stack) cloudError.details = { stack: error.stack };
        throw cloudError;
    }
});

// **** 新增：获取可恢复测评的云函数 ****
AV.Cloud.define('getResumableAssessment', async (request) => {
    console.log("[getResumableAssessment] Function starting...");
    const user = request.currentUser;

    if (!user) {
        console.log("[getResumableAssessment] User not logged in.");
        // 返回 null 或空对象表示没有可恢复的测评，而不是抛出错误，因为前端需要区分这种情况
        return null; 
    }
    console.log(`[getResumableAssessment] User logged in: ${user.id}`);

    try {
        const query = new AV.Query('Assessment');
        // **** Include all necessary pointers ****
        query.include('userPointer');
        // query.include('stationPointer'); // **** 移除 ****
        // query.include('positionPointer'); // **** 移除 ****
        // **** 新增：包含 UserProfile 的关联指针 ****
        query.include('userPointer.stationPointer');
        query.include('userPointer.positionPointer');

        // **** 从 request.params 中获取 assessmentId ****
        const { assessmentId } = request.params;
        if (!assessmentId) {
            // 如果前端没有传递 assessmentId，则抛出错误
            throw new AV.Cloud.Error('缺少必要的 assessmentId 参数。', { code: 400 });
        }

        // **** 使用从请求中获取的 assessmentId ****
        const assessment = await query.get(assessmentId, { useMasterKey: true });
        // ... (Verify ownership and status) ...

        // Fetch details (Existing logic)
        // ...

        // Assemble response (Use included pointers)
        const assesseeProfile = assessment.get('userPointer');
        // **** 修改：从 assesseeProfile 获取 station 和 position ****
        const station = assesseeProfile ? assesseeProfile.get('stationPointer') : null;
        const position = assesseeProfile ? assesseeProfile.get('positionPointer') : null;

        // ... (Assemble userAnswers and reconstructedQuestions) ...
        // **** 查询并处理 AssessmentDetail ****
        const detailQuery = new AV.Query('AssessmentDetail');
        detailQuery.equalTo('assessmentPointer', assessment); // Use the fetched assessment object
        detailQuery.limit(1000); // Maximum details per assessment
        const assessmentDetails = await detailQuery.find({ useMasterKey: true });
        console.log(`[getResumableAssessment] Found ${assessmentDetails.length} AssessmentDetail records for assessment ${assessmentId}.`);

        const userAnswers = {};
        const reconstructedQuestions = [];
        for (const detail of assessmentDetails) {
            const questionId = detail.get('questionId');
            const questionContent = detail.get('questionContent');
            // **** 获取其他必要字段 ****
            const score = detail.get('score'); // score might be null
            const comment = detail.get('comment') ?? '';
            const durationSeconds = detail.get('durationSeconds') ?? 0;
            const detailStartTime = detail.get('startTime'); // startTime might be null
            const standardScore = detail.get('standardScore');
            const section = detail.get('section');
            const type = detail.get('type');
            const knowledgeSource = detail.get('knowledgeSource');

            // 检查关键字段是否存在 (questionId 和 content 必须有)
            if (questionId !== undefined && questionId !== null && questionContent !== undefined && questionContent !== null) {
                userAnswers[questionId] = {
                    score: score,
                    comment: comment,
                    duration: durationSeconds,
                    startTime: detailStartTime ? detailStartTime.toISOString() : null // 确保返回 ISO 格式或 null
                };
                reconstructedQuestions.push({
                    id: questionId,
                    content: questionContent,
                    standardScore: standardScore,
                    section: section,
                    type: type,
                    knowledgeSource: knowledgeSource
                });
            } else {
                console.warn(`[getResumableAssessment] Skipping detail record due to missing questionId or content. Detail ID: ${detail.id}`);
            }
        }

        if (reconstructedQuestions.length === 0 && assessmentDetails.length > 0) {
            console.warn('[getResumableAssessment] Warning: Found details but failed to reconstruct questions. Check detail processing logic and required fields (questionId, content).');
        } else if (reconstructedQuestions.length === 0) {
            console.log('[getResumableAssessment] No questions reconstructed, likely because no details were found or details were invalid.');
        }

        // Sort questions by ID for consistency
        reconstructedQuestions.sort((a, b) => a.id - b.id);
        console.log(`[getResumableAssessment] Reconstructed ${reconstructedQuestions.length} questions.`); // 添加日志

        const resumableData = {
            objectId: assessment.id,
            assessmentId: assessment.get('assessmentId'), // Use assessmentId from backend
            // Assessee Info from userPointer
            employeeName: assesseeProfile ? assesseeProfile.get('name') : 'N/A',
            employeeId: assesseeProfile ? assesseeProfile.get('employeeId') : 'N/A',
            // Station/Position Info from pointers
            stationCode: station ? station.get('stationCode') : null,
            stationName: station ? station.get('stationName') : null,
            positionCode: position ? position.get('positionCode') : null,
            positionName: position ? position.get('positionName') : null,
            // **** Other assessment fields ****
            status: assessment.get('status'), // Keep status
            currentQuestionIndex: assessment.get('currentQuestionIndex') ?? 0, // Default to 0 if null
            elapsedSeconds: assessment.get('elapsedSeconds') ?? 0,
            totalActiveSeconds: assessment.get('totalActiveSeconds') ?? 0,
            timestamp: assessment.get('timestamp') ? assessment.get('timestamp').toISOString() : null, // Pause time as ISO string or null
            startTime: assessment.get('startTime') ? assessment.get('startTime').toISOString() : null, // Original start time as ISO string or null
            assessorName: assessment.get('assessorName'), // Might be null
            maxScore: assessment.get('maxPossibleScore'), // Might be null
            // **** 关键：添加 questions 和 answers ****
            questions: reconstructedQuestions,
            answers: userAnswers
        };

        // **** 移除外部赋值 ****
        // resumableData.userAnswers = userAnswers;
        // resumableData.reconstructedQuestions = reconstructedQuestions;

        return resumableData;

    } catch (error) {
        console.error(`[getResumableAssessment] Error fetching resumable assessment for user ${user.id}:`, error);
        // 抛出错误，让前端知道获取失败
        throw new AV.Cloud.Error('获取可恢复的测评失败: ' + error.message, {
             code: 500, 
             details: error.stack 
        });
    }
});

// **** 新增：处理暂停测评的云函数 ****
AV.Cloud.define('pauseAssessmentCloud', async (request) => {
    console.log('[pauseAssessmentCloud] Function started.');
    // **** 1. 身份验证 ****
    const user = request.currentUser;
    if (!user) {
        throw new AV.Cloud.Error('用户未登录，无法暂停测评。', { code: 401 });
    }
    console.log(`[pauseAssessmentCloud] User authenticated: ${user.id}`);

    const { assessmentData, assessmentObjectId } = request.params; // **** 前端需要传递 objectId ****

    if (!assessmentData) {
        throw new AV.Cloud.Error('Missing assessmentData parameter.', { code: 400 });
    }
    if (!assessmentData.assessmentId) {
        throw new AV.Cloud.Error('Assessment data must have an assessmentId.', { code: 400 });
    }
    console.log(`[pauseAssessmentCloud] Processing assessment (objectId: ${assessmentObjectId}, assessmentId: ${assessmentData.assessmentId})...`);

    const stationCode = assessmentData.stationCode;
    const stationName = assessmentData.stationName;
    const positionCode = assessmentData.positionCode;
    const positionName = assessmentData.positionName;

    // **** Add validation for names if creation is possible ****
    if (!stationCode || !stationName || !positionCode || !positionName) {
         throw new AV.Cloud.Error('暂停失败：缺少站点或岗位代码/名称。', { code: 400 });
    }

    try {
        // --- 1. 查找或创建 Assessment 对象，并验证权限 ---
        console.log('[pauseAssessmentCloud] Step 1: Finding/creating Assessment object...');
        const Assessment = AV.Object.extend('Assessment');
        let assessment;

        if (assessmentObjectId) {
            // 如果前端传递了 objectId
        try {
            const query = new AV.Query('Assessment');
                assessment = await query.get(assessmentObjectId, { useMasterKey: true });
                console.log(`[pauseAssessmentCloud] Found existing assessment by objectId: ${assessment.id}`);
                
                // **** 权限检查 ****
                const owner = assessment.get('owner');
                if (!owner || owner.id !== user.id) {
                     console.error(`[pauseAssessmentCloud] Permission denied: User ${user.id} tried to pause assessment ${assessment.id} owned by ${owner?.id}`);
                    throw new AV.Cloud.Error('您没有权限暂停此测评记录。', { code: 403 });
            }
                console.log(`[pauseAssessmentCloud] Ownership verified for user ${user.id}.`);
                assessment.set('status', 'paused'); // 更新状态为 paused
            } catch (error) {
                 console.error(`[pauseAssessmentCloud] Error fetching assessment with objectId ${assessmentObjectId}:`, error);
                throw new AV.Cloud.Error('找不到要暂停的测评记录或获取时出错。', { code: 404 });
            }
                 } else {
            // 如果没有 objectId (第一次暂停)
             console.log(`[pauseAssessmentCloud] No objectId provided. Creating new assessment.`);
             assessment = new Assessment();
            assessment.set('owner', user);
            assessment.set('status', 'paused');
            assessment.set('assessmentId', assessmentData.assessmentId);
        }

        // --- 填充或更新 Assessment 数据 ---
        // **** ADD fields for the person being assessed ****
        const assesseeEmployeeId = assessmentData.employeeId;
        const assesseeEmployeeName = assessmentData.employeeName;
        const assesseeUserProfile = await findUserProfileByEmployeeId(assesseeEmployeeId, assesseeEmployeeName);
        assessment.set('userPointer', assesseeUserProfile);

        // ... Set other fields (startTime, timestamp, activeSeconds, currentQuestionIndex, etc.) ...
        assessment.set('startTime', assessmentData.startTime ? new Date(assessmentData.startTime) : new Date());
        assessment.set('timestamp', assessmentData.timestamp ? new Date(assessmentData.timestamp) : new Date());
        assessment.set('totalActiveSeconds', Number(assessmentData.totalActiveSeconds) || 0);
        assessment.set('elapsedSeconds', Number(assessmentData.elapsedSeconds) || 0);
        assessment.set('durationMinutes', Math.round((Number(assessmentData.totalActiveSeconds) || 0) / 60));
        assessment.set('currentQuestionIndex', Number(assessmentData.currentQuestionIndex) || 0);
        assessment.set('assessorName', assessmentData.assessor || null);
        assessment.set('totalScore', null);
        assessment.set('maxPossibleScore', assessmentData.maxScore || null);
        assessment.set('scoreRate', null);
        assessment.unset('endTime');

        // **** Find Station and Position Objects ****
        const stationObject = await findStationByCode(stationCode, stationName);
        const positionObject = await findPositionByCode(positionCode, positionName);
        // Add checks if station/position are mandatory
        if (!stationObject) throw new Error("暂停失败：无效的站点代码。");
        if (!positionObject) throw new Error("暂停失败：无效的岗位代码。");

        // --- Set/Update fields --- (Use Pointers)
        assessment.set('userPointer', assesseeUserProfile);
        // assessment.set('stationPointer', stationObject);   // **** 移除 ****
        // assessment.set('positionPointer', positionObject); // **** 移除 **** 

        // **** 新增：更新 UserProfile ****
        try {
            console.log(`[pauseAssessmentCloud] Updating UserProfile ${assesseeUserProfile.id} with station/position pointers...`);
            assesseeUserProfile.set('stationPointer', stationObject);
            assesseeUserProfile.set('positionPointer', positionObject);
            await assesseeUserProfile.save(null, { useMasterKey: true });
            console.log(`[pauseAssessmentCloud] UserProfile ${assesseeUserProfile.id} updated successfully.`);
        } catch (profileSaveError) {
            console.error(`[pauseAssessmentCloud] Error updating UserProfile ${assesseeUserProfile.id}:`, profileSaveError);
            throw new AV.Cloud.Error(`更新用户信息时出错: ${profileSaveError.message}`, { code: 500 });
        }

        // --- 2. 保存 Assessment 对象 --- 
        console.log('[pauseAssessmentCloud] Step 2: Saving Assessment object...');
        const savedAssessment = await assessment.save(null, { useMasterKey: true });
        console.log(`[pauseAssessmentCloud] Assessment saved/updated: ${savedAssessment.id}`);

        // --- 3. & 4. 保存 AssessmentDetail 对象 (逻辑同 submit) ---
        console.log('[pauseAssessmentCloud] Step 3 & 4: Saving/Updating AssessmentDetail objects...');
        // ... (查找或创建 Detail 的逻辑保持不变，确保 detail.set('assessmentPointer', savedAssessment)) ...
        // ... (注意处理 startTime) ...
        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
        const detailObjectsToSave = [];
        const existingDetailsMap = new Map();
         if (assessmentObjectId) { // 只有更新时才需要查旧的
            const detailQuery = new AV.Query('AssessmentDetail');
             detailQuery.equalTo('assessmentPointer', savedAssessment);
             detailQuery.limit(1000);
            const existingDetails = await detailQuery.find({ useMasterKey: true });
            existingDetails.forEach(detail => {
                const qId = detail.get('questionId');
                 if (qId !== undefined) existingDetailsMap.set(qId, detail);
            });
        }
         const questions = assessmentData.questions || [];
         const answers = assessmentData.answers || {};
         // **** 新增日志 ****
         console.log(`[pauseAssessmentCloud] assessmentData received. Questions count: ${questions.length}, Answers keys count: ${Object.keys(answers).length}`);
         if (questions.length === 0) {
             console.warn('[pauseAssessmentCloud] Warning: The questions array received from the frontend is empty. No details will be saved.');
         }

        for (const question of questions) {
             let questionIdNum;
            try {
                 questionIdNum = parseInt(question.id, 10);
                 if (isNaN(questionIdNum)) continue;
             } catch (e) { continue; }
             
             let detailObject = existingDetailsMap.get(questionIdNum);
            if (!detailObject) {
                detailObject = new AssessmentDetail();
                 detailObject.set('assessmentPointer', savedAssessment);
                 detailObject.set('questionId', questionIdNum);
             } // else { console.log(`Updating detail for qId ${questionIdNum}`); }

             detailObject.set('questionContent', question.content);
             detailObject.set('standardScore', question.standardScore);
             detailObject.set('section', question.section);
             detailObject.set('type', question.type);
             detailObject.set('knowledgeSource', question.knowledgeSource);
             const answer = answers[questionIdNum];
             detailObject.set('score', answer?.score ?? null);
             detailObject.set('comment', answer?.comment ?? '');
             detailObject.set('durationSeconds', Number(answer?.duration ?? 0));
             // **** 保存 startTime ****
             detailObject.set('startTime', answer && answer.startTime ? new Date(answer.startTime) : null);
            detailObjectsToSave.push(detailObject);
        }
        if (detailObjectsToSave.length > 0) {
            // **** 新增日志 ****
            console.log(`[pauseAssessmentCloud] Attempting to save/update ${detailObjectsToSave.length} AssessmentDetail objects...`);
            await AV.Object.saveAll(detailObjectsToSave, { useMasterKey: true });
            // **** 新增日志 ****
            console.log(`[pauseAssessmentCloud] Successfully saved/updated ${detailObjectsToSave.length} AssessmentDetails.`);
        } else {
            // **** 修改日志 ****
            console.log(`[pauseAssessmentCloud] No AssessmentDetail objects were prepared to save/update.`);
        }

        console.log(`[pauseAssessmentCloud] Processing completed for assessment: ${savedAssessment.id}.`);
        // **** 返回 objectId ****
        return savedAssessment.id;

    } catch (error) {
        console.error(`[pauseAssessmentCloud] Error processing pause (objectId: ${assessmentObjectId}):`, error);
        // 保持之前的错误抛出逻辑
        const cloudError = new AV.Cloud.Error(error.message || '保存暂停状态时发生未知错误。', {
            code: error.code || (error instanceof AV.Cloud.Error ? 400 : 500)
        });
        if (error.stack) cloudError.details = { stack: error.stack };
        throw cloudError;
    }
});

// 获取岗位列表 (示例，具体实现可能不同)
AV.Cloud.define('getPositions', async (request) => {
// ... existing code ...
});

// 如果你还有其他的云函数或 Hook，应该也定义在这个文件里
// 例如: AV.Cloud.define('anotherFunction', ...);
// 例如: AV.Cloud.afterSave('SomeClass', ...); 