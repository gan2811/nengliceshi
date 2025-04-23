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

        // --- 2. **修改：查找或创建 Assessment 对象** ---
        console.log(`[submitAssessmentCloud] Step 2: Finding or creating Assessment object (frontendId: ${assessmentId})...`);
        const Assessment = AV.Object.extend('Assessment');
        let assessment;

        // **新增：尝试根据 frontendId 查找已存在的 paused 记录**
        const existingQuery = new AV.Query('Assessment');
        // 注意：需要确保 assessmentId (前端ID) 确实被存放在 frontendId 字段中
        // 我们在 pauseAssessmentCloud 中是这样做的，这里保持一致
        let assessmentIdNumForQuery;
        try {
            assessmentIdNumForQuery = parseInt(assessmentId, 10);
            if (isNaN(assessmentIdNumForQuery)) throw new Error('Invalid ID format');
        } catch (e) {
             console.error(`[submitAssessmentCloud] Invalid frontendId format for query: ${assessmentId}`);
             assessmentIdNumForQuery = null;
        }
        
        // **** 添加日志 ****
        console.log(`[submitAssessmentCloud] Attempting to find existing assessment with assessmentId: ${assessmentIdNumForQuery}`);

        if (assessmentIdNumForQuery !== null) {
             existingQuery.equalTo('assessmentId', assessmentIdNumForQuery); 
             // existingQuery.equalTo('status', 'paused'); // 可选：严格要求必须是 paused 状态才能更新
             assessment = await existingQuery.first({ useMasterKey: true });
             // **** 添加日志 ****
             console.log(`[submitAssessmentCloud] Result of existing assessment query:`, assessment ? `Found objectId: ${assessment.id}` : 'null');
        }

        if (assessment) {
            // **** 添加日志 ****
            console.log(`[submitAssessmentCloud] Decision: Updating existing assessment (objectId: ${assessment.id}).`);
            // 更新状态和完成信息
            assessment.set('status', 'completed');
        } else {
            // **** 添加日志 ****
            console.log(`[submitAssessmentCloud] Decision: Creating new assessment for assessmentId: ${assessmentId}.`);
            assessment = new Assessment();
            // 设置 assessmentId (确保是 Number)
            let assessmentIdNumForSet;
            try {
                assessmentIdNumForSet = parseInt(assessmentId, 10);
                if (isNaN(assessmentIdNumForSet)) throw new AV.Cloud.Error(`无效的 assessmentId: ${assessmentId}`, { code: 400 });
            } catch (parseError) {
                 throw new AV.Cloud.Error(`解析 assessmentId 失败: ${assessmentId}`, { code: 400 });
            }
            assessment.set('assessmentId', assessmentIdNumForSet);
            assessment.set('status', 'completed'); // 新记录也是 completed
        }

        // --- 统一设置/更新其他字段 ---
        assessment.set('userPointer', AV.Object.createWithoutData('UserProfile', userProfile.id));
        assessment.set('assessorName', assessorName);
        assessment.set('positionCode', assessmentData.position);
        assessment.set('startTime', startTime); // startTime 应该是首次开始时间，更新时也用原来的
        assessment.set('endTime', assessmentEndTime); // 完成时间
        assessment.set('totalActiveSeconds', totalActiveSeconds);
        assessment.set('durationMinutes', Math.round(totalActiveSeconds / 60));
        assessment.set('totalScore', totalScore);
        assessment.set('maxPossibleScore', maxPossibleScore);
        assessment.set('scoreRate', scoreRate);
        // 清除暂停时可能存在的字段
        assessment.unset('elapsedSeconds');
        assessment.unset('currentQuestionIndex');

        const savedAssessment = await assessment.save(null, { useMasterKey: true });
        console.log(`[submitAssessmentCloud] Assessment saved/updated: ${savedAssessment.id}`);

        // --- 3. **修改：更新或创建 AssessmentDetail 对象数组** ---
        console.log(`[submitAssessmentCloud] Step 3: Preparing ${Array.isArray(questions) ? questions.length : 0} AssessmentDetail objects...`);
        const AssessmentDetail = AV.Object.extend('AssessmentDetail');
        const detailObjectsToSave = [];
        const existingDetailsMap = new Map();

        // **新增：如果是更新，先查询已有的 Detail 记录**
        if (assessment && assessment.id) { // 检查 assessment 是否非空且有 objectId (表示它是从数据库找到的)
            console.log(`[submitAssessmentCloud] Assessment ${assessment.id} existed, fetching its details...`);
            const detailQuery = new AV.Query('AssessmentDetail');
            // 使用 savedAssessment，因为此时 assessment 已经保存/更新，拥有最新的 objectId
            detailQuery.equalTo('assessmentPointer', savedAssessment); 
            detailQuery.limit(1000);
            const existingDetails = await detailQuery.find({ useMasterKey: true });
            existingDetails.forEach(detail => {
                const qId = detail.get('questionId'); // 假设 questionId 是 Number
                if (qId !== undefined) {
                    existingDetailsMap.set(qId, detail);
                }
            });
            console.log(`[submitAssessmentCloud] Found ${existingDetailsMap.size} existing details for assessment ${savedAssessment.id}.`);
        }

        if (Array.isArray(questions)) {
            for (const question of questions) { // 改为 for...of 以便处理 async/await（虽然这里没用）
                if (!question || typeof question !== 'object' || !question.id) {
                    console.warn("[submitAssessmentCloud] Skipping invalid question object:", question);
                    continue;
                }
                const answer = answers[question.id];
                let detailObject;
                let questionIdNum;
                try {
                    questionIdNum = parseInt(question.id, 10);
                    if (isNaN(questionIdNum)) throw new Error('Invalid question ID format');
                } catch (e) {
                    console.warn(`[submitAssessmentCloud] Invalid question ID format ${question.id}. Skipping detail.`);
                    continue;
                }

                detailObject = existingDetailsMap.get(questionIdNum); // 尝试获取旧的

                if (!detailObject) { // 如果没有旧的，创建新的
                    detailObject = new AssessmentDetail();
                    detailObject.set('assessmentPointer', savedAssessment);
                    detailObject.set('questionId', questionIdNum);
                } else {
                    console.log(`[submitAssessmentCloud] Updating existing detail for questionId ${questionIdNum}.`);
                }

                // 更新或设置 Detail 数据
                detailObject.set('questionContent', question.content);
                detailObject.set('standardScore', question.standardScore);
                detailObject.set('section', question.section);
                detailObject.set('type', question.type);
                detailObject.set('knowledgeSource', question.knowledgeSource);
                detailObject.set('score', answer && answer.score !== undefined && answer.score !== null ? answer.score : null);
                detailObject.set('comment', answer && answer.comment ? answer.comment : '');
                detailObject.set('durationSeconds', Number(answer && answer.duration !== undefined && answer.duration !== null ? answer.duration : 0));
                // 提交时通常不需要保存 standardAnswer
                // detailObject.set('standardAnswer', question.standardAnswer);

                detailObjectsToSave.push(detailObject);
            }
        } else {
            console.error("[submitAssessmentCloud] Error: assessmentData.questions is not an array!");
        }

        // --- 4. 批量保存 AssessmentDetail 对象 (使用 saveAll) ---
        if (detailObjectsToSave.length > 0) {
            console.log(`[submitAssessmentCloud] Step 4: Saving/Updating ${detailObjectsToSave.length} AssessmentDetail objects...`);
            await AV.Object.saveAll(detailObjectsToSave, { useMasterKey: true });
            console.log(`[submitAssessmentCloud] ${detailObjectsToSave.length} AssessmentDetails saved/updated.`);
        } else {
             console.log(`[submitAssessmentCloud] Step 4: No valid AssessmentDetail objects to save.`);
        }

        console.log(`[submitAssessmentCloud] Assessment processing completed successfully for assessmentId: ${assessmentId}.`);
        return savedAssessment.id; // 返回成功保存/更新的 Assessment 的 objectId

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
            // **** 修正：统一使用 assessmentId (Number) 作为查询依据 ****
            let assessmentIdNum;
            try {
                assessmentIdNum = parseInt(assessmentId, 10); // assessmentId 是前端传来的 ID
                if (isNaN(assessmentIdNum)) throw new Error('Invalid ID format');
            } catch (e) {
                console.error(`[pauseAssessmentCloud] Invalid assessmentId format for query: ${assessmentId}`);
                assessmentIdNum = null; // 无法查询
            }

            if (assessmentIdNum !== null) {
                query.equalTo('assessmentId', assessmentIdNum);
                assessment = await query.first({ useMasterKey: true });
            }

            if (!assessment) {
                console.log(`[pauseAssessmentCloud] No existing assessment found for assessmentId ${assessmentIdNum}. Creating new record.`);
                assessment = new Assessment();
                // **** 设置 assessmentId (Number), 移除 frontendId ****
                if (assessmentIdNum !== null) {
                     assessment.set('assessmentId', assessmentIdNum);
                 } else {
                     // 如果前端传来的 ID 无效，这里可能会有问题，或者依赖自动生成的 objectId
                     console.error(`[pauseAssessmentCloud] Cannot set assessmentId because the provided ID was invalid: ${assessmentId}`);
                     // 可以考虑在此处抛出错误阻止继续执行
                     // throw new AV.Cloud.Error('Invalid assessment ID provided.', { code: 400 });
                 }
                // assessment.set('frontendId', assessmentId); // <-- 移除
            } else {
                console.log(`[pauseAssessmentCloud] Found existing assessment ${assessment.id} for assessmentId ${assessmentIdNum}. Updating.`);
            }
        } catch (findError) {
             console.error(`[pauseAssessmentCloud] Error finding assessment for assessmentId ${assessmentIdNum}, creating new one. Error:`, findError);
             assessment = new Assessment();
             // **** 尝试设置 assessmentId (Number) ****
             let assessmentIdNumForCatch;
             try {
                  assessmentIdNumForCatch = parseInt(assessmentId, 10);
                  if (isNaN(assessmentIdNumForCatch)) throw new Error('Invalid ID format');
                  assessment.set('assessmentId', assessmentIdNumForCatch);
             } catch (e) {
                   console.error(`[pauseAssessmentCloud] Error setting assessmentId in catch block: ${assessmentId}`);
             }
             // assessment.set('frontendId', assessmentId); // <-- 移除
        }

        // --- 填充或更新 Assessment 数据 ---
        // **修改：改为处理 UserProfile，与 submitAssessmentCloud 对齐**
        let userProfile;
        if (assessmentData.userInfo && assessmentData.userInfo.employeeId) {
            const userQuery = new AV.Query('UserProfile');
            const employeeIdNum = parseInt(assessmentData.userInfo.employeeId, 10);
            if (!isNaN(employeeIdNum)) {
                userQuery.equalTo('employeeId', employeeIdNum);
                try {
                    userProfile = await userQuery.first({ useMasterKey: true });
                    if (!userProfile) {
                        console.log(`[pauseAssessmentCloud] UserProfile not found (employeeId: ${employeeIdNum}), creating new...`);
                        userProfile = new AV.Object('UserProfile');
                        userProfile.set('employeeId', employeeIdNum);
                        userProfile.set('name', assessmentData.userInfo.name || '未知'); // 使用提供的信息
                        // 可以选择性地设置其他信息，如果前端提供了的话
                        if(assessmentData.userInfo.station) userProfile.set('stationCode', assessmentData.userInfo.station);
                        if(assessmentData.position) userProfile.set('positionCode', assessmentData.position);

                        userProfile = await userProfile.save(null, { useMasterKey: true });
                        console.log(`[pauseAssessmentCloud] New UserProfile created: ${userProfile.id}`);
                    } else {
                        console.log(`[pauseAssessmentCloud] Existing UserProfile found: ${userProfile.id}`);
                        // 可选：如果找到现有用户，是否要用前端传来的信息更新？暂时不更新。
                    }
                    // 设置指向 UserProfile 的指针
                    assessment.set('userPointer', AV.Object.createWithoutData('UserProfile', userProfile.id));
                } catch (userError) {
                    console.error(`[pauseAssessmentCloud] Error finding or creating UserProfile for employeeId ${employeeIdNum}:`, userError);
                    assessment.unset('userPointer'); // 出错则不设置指针
                }
            } else {
                 console.warn(`[pauseAssessmentCloud] Invalid employeeId format: ${assessmentData.userInfo.employeeId}. Cannot process UserProfile.`);
                 assessment.unset('userPointer');
            }
        } else {
             console.warn('[pauseAssessmentCloud] No userInfo or employeeId provided in assessmentData. Cannot process UserProfile.');
             assessment.unset('userPointer');
        }
        // 保留直接设置字段作为补充或备用
        assessment.set('userName', assessmentData.userInfo?.name || null);
        assessment.set('userEmployeeId', assessmentData.userInfo?.employeeId || null);
        assessment.set('userDepartment', assessmentData.userInfo?.department || null);
        assessment.set('userStation', assessmentData.userInfo?.station || null);

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
        if (assessment) {
            // 确保在查询 Detail 时使用正确的 Assessment 对象 (应该是 assessment 而不是 savedAssessment)
            // 因为 savedAssessment 是在之后才通过 assessment.save() 得到的
            const detailQuery = new AV.Query('AssessmentDetail');
            detailQuery.equalTo('assessmentPointer', assessment); // 使用 assessment
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
            // 修正：确保 questionId 是 Number 类型，符合数据库定义
            let questionIdAsNumber;
            try {
                // 尝试将前端传来的 question.id 转换为数字
                // 前端 question.id 可能已经是数字，也可能是数字字符串
                questionIdAsNumber = parseInt(question.id, 10); 
                if (isNaN(questionIdAsNumber)) {
                     console.warn(`[pauseAssessmentCloud] Invalid numeric format for question.id: ${question.id}. Skipping this detail.`);
                     continue; // 跳过这个无效的题目详情
                }
            } catch (parseError) {
                 console.warn(`[pauseAssessmentCloud] Error parsing question.id ${question.id} to number:`, parseError, ". Skipping this detail.");
                 continue; // 跳过这个无法解析的题目详情
            }

            // 使用转换后的数字 ID 进行后续操作
            let detailObject = existingDetailsMap.get(questionIdAsNumber); // 使用数字 ID 查找

            if (!detailObject) {
                // 如果找不到旧的，创建新的
                detailObject = new AssessmentDetail();
                detailObject.set('assessmentPointer', savedAssessment); // Link to the main assessment
                detailObject.set('questionId', questionIdAsNumber); // **** 保存 Number 类型 ****
            } else {
                 console.log(`[pauseAssessmentCloud] Updating existing detail for questionId ${questionIdAsNumber}.`);
            }

            // 更新或设置 Detail 数据
            detailObject.set('questionContent', question.content || '');
            detailObject.set('standardScore', question.standardScore !== undefined ? question.standardScore : null);
            // 修正：从 answer 对象中提取 score 属性值
            const currentAnswer = answers[questionIdAsNumber]; // 获取当前问题的答案对象
            detailObject.set('score', currentAnswer && currentAnswer.score !== undefined ? currentAnswer.score : null);
            // 使用 currentAnswer 访问其他属性，更清晰
            detailObject.set('comment', currentAnswer && currentAnswer.comment ? currentAnswer.comment : '');
            detailObject.set('durationSeconds', Number(currentAnswer && currentAnswer.duration) || 0);
            detailObject.set('startTime', currentAnswer && currentAnswer.startTime ? new Date(currentAnswer.startTime) : null);
            detailObject.set('knowledgeSource', question.knowledgeSource || null);
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