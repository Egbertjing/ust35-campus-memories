import { campusBuildingNames } from './campus-building-names';
export type CampusLanguage = 'zh' | 'en';

const english: Record<string, string> = {
  ...campusBuildingNames,
  香港科技大学: 'HKUST',
  '3D 校园': '3D Campus',
  校园导览: 'Campus guide',
  收起校园导览侧栏: 'Close campus sidebar',
  展开校园导览侧栏: 'Open campus sidebar',
  收起侧栏: 'Close sidebar',
  展开侧栏: 'Open sidebar',
  收起校园导览: 'Close campus guide',
  收起: 'Close',
  校园功能: 'Campus tools',
  校园探索: 'Explore',
  路线导航: 'Directions',
  问校园: 'Ask campus',
  '山海之间，': 'Between hills & sea,',
  走进科大: 'Explore HKUST',
  '。': '.',
  '从高空俯瞰，到海滨漫游。': 'From a bird’s-eye view to the waterfront.',
  '换一个视角，发现清水湾校园。': 'Discover Clear Water Bay from a new angle.',
  真实校园参考: 'The real campus',
  '香港科技大学官方航拍照片，展示日晷广场、教学楼和海滨宿舍':
    'Official HKUST aerial photo of the Sundial, academic buildings and waterfront halls',
  切换相机视角: 'Choose a viewpoint',
  探索视角: 'Viewpoints',
  校园地标: 'Landmarks',
  全校总览: 'Campus overview',
  垂直俯视: 'Top view',
  日晷广场: 'Sundial Piazza',
  '学术大楼 · 中庭': 'Academic Building · Atrium',
  吴家玮学术廊: 'Woo Chia-Wei Academic Concourse',
  学术大楼: 'Academic Building',
  红鸟日晷: 'Red Bird Sundial',
  红鸟俯视: 'Red Bird from above',
  海滨运动场: 'Waterfront Sports Ground',
  海滨运动场看台: 'Waterfront Sports Grandstand',
  海滨宿舍: 'Waterfront Halls',
  '连桥 · LG5 入口': 'Bridge Link · LG5 entrance',
  '连桥 · Bridge Link': 'Bridge Link',
  连桥: 'Bridge Link',
  李兆基校区: 'South Campus',
  医教与创科楼: 'Medical & Innovation Buildings',
  超级运算中心: 'Supercomputing Center',
  人工智能超级运算中心: 'AI Supercomputing Center',
  医学教研综合大楼: 'Medical Education & Research Building',
  李家诚创科大楼: 'Li Ka Shing Innovation Building',
  李兆基商学大楼: 'Lee Shau Kee Business Building',
  逸夫演艺中心: 'Shaw Auditorium',
  图书馆: 'Library',
  本科生宿舍一座: 'Undergraduate Hall I',
  本科生宿舍二座: 'Undergraduate Hall II',
  本科生宿舍三座: 'Undergraduate Hall III',
  '北门 · 大学道': 'North Gate · University Road',
  校园建筑: 'Campus building',
  宿舍连桥电梯塔: 'Hall I bridge lift tower',
  场景图层: 'Scene layers',
  彩色贴图: 'Color textures',
  地标名称: 'Landmark labels',
  校园植被: 'Vegetation',
  '照片与地图参考 · 概念级重建 · 彩色贴图':
    'Photo & map references · Concept model',
  场景操作: 'Scene controls',
  放大: 'Zoom in',
  缩小: 'Zoom out',
  回到总览: 'Back to overview',
  全屏: 'Fullscreen',
  切换全屏: 'Toggle fullscreen',
  自动环绕: 'Auto orbit',
  暂停环绕: 'Pause orbit',
  朝向正北: 'Face north',
  关闭建筑名称: 'Close building label',
  正在展开清水湾校园: 'Opening Clear Water Bay',
  '构建地形、建筑与海岸线…': 'Preparing terrain, buildings and coastline…',
  重试: 'Retry',
  拖动旋转: 'Drag to rotate',
  滚轮缩放: 'Scroll to zoom',
  右键平移: 'Right-drag to pan',
  '单指旋转 · 双指缩放 / 平移': 'One finger to rotate · Pinch to zoom / pan',
  '香港科技大学清水湾校区交互式三维导航。拖动旋转，滚轮缩放；在路线导航中选择起点和终点。':
    'Interactive HKUST Clear Water Bay campus. Drag to rotate and scroll to zoom; choose a start and destination in Directions.',
  '三维校园：方向键平移，使用页面按钮切换视角或缩放':
    '3D campus: use arrow keys to pan, or the controls to change viewpoint and zoom',
  '3D 场景暂时无法加载。请确认浏览器已启用 WebGL 硬件加速后重试。':
    'The 3D scene could not load. Enable WebGL hardware acceleration in your browser and retry.',
  '图形上下文已中断，请刷新页面重新加载校园。':
    'The graphics context was lost. Reload the page to reopen the campus.',
  步行路线规划: 'Walking route planner',
  '3D 路线导航': '3D Directions',
  '选择两点，探索校园。': 'Choose two places. Explore the campus.',
  起点: 'Start',
  终点: 'Destination',
  选择起点: 'Choose a start',
  选择终点: 'Choose a destination',
  选择: 'Choose ',
  在地图上选择起点: 'Pick start on the map',
  在地图上选择终点: 'Pick destination on the map',
  交换起点和终点: 'Swap start and destination',
  查看全程: 'Show full route',
  清空路线: 'Clear route',
  '校园加载后即可选择地点。': 'Choose places once the campus has loaded.',
  '选择起点和终点，或点击准星在地图上选点。':
    'Choose a start and destination, or use the crosshair to pick on the map.',
  路线已高亮: 'Route highlighted',
  步行路线: 'Walking route',
  电梯换层: 'Lift connection',
  路线详情: 'Route details',
  从这里出发: 'Start here',
  到达附近入口: 'Arrive at the nearby entrance',
  步行: 'Walk',
  楼梯: 'Stairs',
  电梯: 'Lift',
  下行: 'down ',
  上行: 'up ',
  约: 'Approx.',
  分钟: 'min',
  段: 'steps',
  ' 公里': ' km',
  ' 米': ' m',
  '路线连接地图中的步道与附近入口。高程、入口和用时为模型估算，实际通行请以现场指引为准。':
    'Routes follow modeled paths and nearby entrances. Elevations, entrances and times are estimates; follow signs on site.',
  校园阶梯: 'Campus stairs',
  校园步行桥: 'Campus footbridge',
  校园道路: 'Campus road',
  校园步道: 'Campus path',
  '日晷广场 · 中庭通道': 'Sundial Piazza · Atrium passage',
  '中庭 · 学术廊通道': 'Atrium · Concourse passage',
  学术廊入口: 'Concourse entrance',
  '中庭电梯 · G/F ↔ LG5': 'Atrium lift · G/F ↔ LG5',
  '宿舍一座电梯 · 10/F ↔ G/F': 'Hall I lift · 10/F ↔ G/F',
  方树泉廊: 'Fong Shu Chuen Promenade',
  '宿舍二座电梯 · 廊桥 ↔ 地面': 'Hall II lift · Promenade ↔ Ground',
  宿舍一座地面出口: 'Hall I ground exit',
  宿舍一座入口: 'Hall I entrance',
  地图选点: 'Map point',
  地图起点: 'Map start',
  地图终点: 'Map destination',
  '点击校园道路或地标，选择起点 A':
    'Click a campus path or landmark to choose start A',
  '点击校园道路或地标，选择终点 B':
    'Click a campus path or landmark to choose destination B',
  '这里附近没有已连接的步道，请点击道路、广场或选择列表中的地点。':
    'No connected path is nearby. Click a path or piazza, or choose a listed place.',
  '请在校园内的道路或广场上选点。': 'Pick a campus path or piazza.',
  '位置已失效，请重新选择起点和终点。':
    'These locations are no longer available. Choose a start and destination again.',
  '起点和终点是同一位置，请选择另一个地点。':
    'Start and destination are the same. Choose a different place.',
  '这两个位置之间暂无连通的步行路线，请换一个附近入口。':
    'No connected walking route was found. Try another nearby entrance.',
  '校园 AI 助手': 'Campus AI assistant',
  '找建筑，问路线。': 'Find buildings. Ask for directions.',
  模型待配置: 'Model not configured',
  '正在读取配置…': 'Checking configuration…',
  重新检查模型配置: 'Check model configuration again',
  '无法读取模型配置。': 'Could not read the model configuration.',
  '配置本地 API Key 后即可提问。地图选点和路线导航仍可直接使用。':
    'Configure a local API key to use the assistant. Map picking and directions are available now.',
  校园对话: 'Campus conversation',
  可以这样问: 'Try asking',
  '图书馆在哪儿？': 'Where is the library?',
  '我在日晷广场，去海滨运动场怎么走？':
    'How do I get from the Sundial Piazza to the waterfront sports ground?',
  找到李兆基商学大楼并显示标签:
    'Find the Lee Shau Kee Business Building and show its label',
  地图操作结果: 'Map action results',
  '正在完成查询…': 'Working on your request…',
  对话方式: 'Conversation mode',
  文字输入: 'Text',
  语音对话: 'Voice',
  向校园助手提问: 'Ask the campus assistant',
  '例如：我在日晷，去图书馆怎么走？':
    'For example: How do I get from the Sundial to the library?',
  清空对话: 'Clear conversation',
  可随时停止: 'Stop at any time',
  'Enter 发送': 'Enter to send',
  停止: 'Stop',
  发送: 'Send',
  取消: 'Cancel',
  '助手会根据校园模型操作地图。入口和路线为估算，以现场指引为准。':
    'The assistant operates this campus model. Entrances and routes are estimates; follow signs on site.',
  '已停止本次提问；已完成的地图操作会保留。':
    'Request stopped. Completed map actions are kept.',
  '暂时无法完成提问，请重试。':
    'Could not complete your request. Please retry.',
  '模型返回格式不正确，请重试。':
    'The model returned an invalid response. Please retry.',
  '模型请求失败，请重试。': 'The model request failed. Please retry.',
  '模型没有返回有效回答，请重试。':
    'The model returned no usable answer. Please retry.',
  '请输入 1–1000 字的问题。': 'Enter a question of 1–1000 characters.',
  '本次操作步骤过多，请将问题拆成更具体的一步。':
    'This request needs too many steps. Try a more specific question.',
  '校园助手暂时不可用，请重试。':
    'The campus assistant is unavailable. Please retry.',
  按住说话: 'Hold to talk',
  '按住说话，松开发送': 'Hold to talk; release to send',
  '正在打开麦克风…': 'Opening microphone…',
  正在聆听: 'Listening',
  松开发送: 'Release to send',
  '正在识别…': 'Transcribing…',
  '正在查询校园…': 'Asking campus…',
  '正在准备语音…': 'Preparing audio…',
  '正在播报 · 按住可打断': 'Speaking · Hold to interrupt',
  '试着说：“我在日晷广场，想去图书馆。”':
    'Try: “I’m at the Sundial Piazza. How do I get to the library?”',
  语音回复: 'Spoken replies',
  播放回复: 'Play reply',
  '正在检查语音配置…': 'Checking voice configuration…',
  '语音服务尚未配置，可继续使用文字提问。':
    'Voice is not configured. You can still type your question.',
  '按住录音，松开发送；最多 30 秒。首次请先允许麦克风权限。':
    'Hold to record, release to send. Up to 30 seconds. Allow microphone access the first time.',
  '听到：': 'Heard: ',
  '松开后，录音发送至豆包识别；问题交给 DeepSeek，回复由豆包播报。本应用不保存录音。':
    'On release, audio is sent to Doubao for transcription. DeepSeek answers, and Doubao speaks the reply. This app does not store recordings.',
  '没有听清，请再说一次。': 'Could not hear you clearly. Please try again.',
  '语音对话未完成，请重试。': 'Voice conversation failed. Please retry.',
  '麦克风权限未开启。请允许此页面使用麦克风，然后重试。':
    'Allow microphone access for this page, then try again.',
  '无法打开麦克风。': 'Could not open the microphone.',
  '无法播放回复。': 'Could not play the reply.',
  '语音需要在 localhost 或 HTTPS 页面使用。':
    'Voice requires localhost or HTTPS.',
  '录音结束失败，请重试。': 'Could not finish recording. Please retry.',
  '录音太短，请按住按钮说完一句话再松开。':
    'Recording is too short. Hold the button until you finish speaking.',
  '语音服务暂时不可用，请重试。': 'Voice service is unavailable. Please retry.',
  '浏览器暂停了声音，点击“播放回复”即可播放。':
    'Audio was paused by the browser. Select “Play reply” to listen.',
  '尚未配置语音服务，请设置 VOLC_VOICE_API_KEY。':
    'Voice is not configured. Set VOLC_VOICE_API_KEY.',
  '不支持这个工具。': 'This tool is not supported.',
  '工具参数必须为 JSON 对象。': 'Tool parameters must be a JSON object.',
  '工具参数缺失或包含不支持的字段。':
    'Tool parameters are missing or contain unsupported fields.',
  '搜索词应为 100 字以内的地点名称。':
    'Search with a place name of up to 100 characters.',
  '没有找到这个地点，请确认名称。':
    'No matching place was found. Check the name.',
  '已清除路线。': 'Route cleared.',
  '地点 id 不存在，请先搜索地点。':
    'Unknown place ID. Search for the place first.',
  '入口、高程和用时为概念模型估算，实际通行以现场指引为准。':
    'Entrances, elevations and times are model estimates. Follow signs on site.',
  '标签开关必须为布尔值。': 'Label visibility must be a boolean.',
  '场景操作未完成，请等待校园加载完成后重试。':
    'The scene is not ready. Wait for the campus to load and retry.',
  '暂未连接可用的步行入口，请选择附近已连接的地点。':
    ' has no connected walking entrance. Choose a nearby connected place.',
  '找到 ': 'Found ',
  ' 个地点': ' places',
  已定位: 'Focused on ',
  并显示标签: ' and enabled its label',
  已显示: 'Showing ',
  已隐藏: 'Hidden ',
  的标签: ' label',
  ' 的路线': ' route',
  '模型接口地址配置不正确。': 'The model API address is invalid.',
  '模型接口配置不正确，请使用 HTTPS API 地址。':
    'Use an HTTPS address for the model API.',
  '工具调用格式不正确。': 'The tool call format is invalid.',
  '模型返回了不支持的工具调用。': 'The model requested an unsupported tool.',
  '对话格式不正确或内容过长。': 'The conversation is invalid or too long.',
  '消息格式不正确。': 'Invalid message format.',
  '用户消息格式不正确。': 'Invalid user message format.',
  '助手消息格式不正确。': 'Invalid assistant message format.',
  '工具结果与调用不匹配。': 'The tool result does not match its call.',
  '不支持这种消息角色。': 'This message role is not supported.',
  '对话中的工具调用尚未完成。':
    'A tool call in the conversation is incomplete.',
  '尚未配置 API Key。请在本地 .env.local 中设置 DEEPSEEK_API_KEY 后重启开发服务器。':
    'Set DEEPSEEK_API_KEY in the local .env.local file and restart the development server.',
  '请求已停止或超时，请重试。':
    'The request stopped or timed out. Please retry.',
  '暂时无法连接模型服务，请检查网络和接口地址。':
    'Could not reach the model service. Check the network and API address.',
  'API Key 无效或没有访问权限，请检查本地配置。':
    'The API key is invalid or lacks access. Check local configuration.',
  '模型账户余额不足，请检查 API 账户。':
    'Insufficient API credit. Check the model account.',
  '模型请求过于频繁，请稍后重试。':
    'Too many model requests. Try again shortly.',
  '模型服务暂时不可用，请稍后重试。':
    'The model service is unavailable. Try again shortly.',
  '模型服务返回了无效响应。': 'The model service returned an invalid response.',
  '模型服务没有返回有效回答。': 'The model service returned no usable answer.',
  '模型回复超出长度限制，请缩短问题后重试。':
    'The reply is too long. Try a shorter question.',
  '模型回答格式不正确。': 'The model answer has an invalid format.',
  '模型未返回文本或工具调用。':
    'The model returned neither text nor a tool call.',
  '语音服务地址配置不正确。': 'The voice service address is invalid.',
  '语音采样率配置不正确。': 'The voice sample rate is invalid.',
  '语音识别响应不完整。': 'The transcription response is incomplete.',
  '语音识别协议不匹配。': 'The transcription protocol does not match.',
  '语音识别服务拒绝了请求，请检查语音资源权限或额度。':
    'Transcription was refused. Check voice access and credit.',
  '语音识别响应长度异常。': 'The transcription response length is invalid.',
  '语音识别结果格式不正确。': 'The transcription result has an invalid format.',
  '语音识别未完成，请重试。': 'Transcription did not complete. Please retry.',
  '请录制 0.3–30 秒的语音。': 'Record between 0.3 and 30 seconds of audio.',
  '无法连接语音识别服务，请检查语音资源权限或网络。':
    'Could not reach transcription. Check voice access and the network.',
  '语音识别超时，请重试。': 'Transcription timed out. Please retry.',
  '没有听清，请靠近麦克风再说一次。':
    'Could not hear you clearly. Move closer to the microphone and try again.',
  '这段语音较长，请分成两次提问。':
    'This recording is too long. Split it into two questions.',
  '语音识别已取消。': 'Transcription cancelled.',
  '语音上传中断，请重试。': 'Audio upload was interrupted. Please retry.',
  '语音识别响应无法解析。': 'Could not parse the transcription response.',
  '语音识别连接中断，请重试。':
    'The transcription connection was interrupted. Please retry.',
  '无法启动语音识别，请重试。': 'Could not start transcription. Please retry.',
  '播报文字需要为 1–2000 字。': 'Spoken text must contain 1–2000 characters.',
  '语音合成服务不可用，请检查语音资源权限或额度。':
    'Speech synthesis is unavailable. Check voice access and credit.',
  '语音合成返回格式不正确。': 'The speech synthesis response is invalid.',
  '语音合成失败，请检查音色和语音资源配置。':
    'Speech synthesis failed. Check the voice configuration.',
  '播报音频过长。': 'Spoken audio is too long.',
  '语音响应过长。': 'The voice response is too long.',
  '语音合成未完成，请重试。':
    'Speech synthesis did not complete. Please retry.',
  前往: 'Go to ',
  定位: 'Locate ',
};

// One pass prevents shorter place names from corrupting longer ones.
const pattern = new RegExp(
  Object.keys(english)
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);

export function translateCampusText(
  text: string,
  language: CampusLanguage,
): string {
  if (language === 'zh') return text;
  return english[text] ?? text.replace(pattern, (key) => english[key]);
}
