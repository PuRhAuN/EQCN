// 保持原有逻辑，只优化性能问题

// 1. 正则表达式外置（避免重复创建）
const DATE_REGEX = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;

function getTodayMMDD() {
	const today = new Date();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return `${month}-${day}`;
}

// 深度为0的处理保持在计算函数中（您原来的逻辑）
function get_maxIntensity(magnitude, depth) {
	if (typeof magnitude !== "number") magnitude = Number(magnitude);
	// 修复深度为0的问题：确保depth至少为1
	if (typeof depth !== 'number' || depth === 0) {
		depth = 10;
	}
	if (depth <= 40) {
		return ((0.24 + 1.29 * magnitude)).toFixed(1);
	} else {
		return (1.5 * magnitude - 3.5 * Math.log10(depth) + 4.5).toFixed(1);
	}
}

// 2. 添加缓存机制（避免重复读取JSON）
let cachedData = null;
let cacheTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时

async function initData() {
	async function readLocalJson() {
		// 检查缓存
		if (cachedData && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)) {
			console.log('使用缓存数据');
			return cachedData;
		}

		try {
			const response = await fetch('./img/Historical_earthquakes.json');
			if (!response.ok) {
				throw new Error(`请求失败：${response.status} ${response.statusText}`);
			}
			const jsData = await response.json();

			// 更新缓存
			cachedData = jsData;
			cacheTime = Date.now();

			return jsData;
		} catch (error) {
			console.error('读取JSON失败：', error.message);
			return null;
		}
	}

	const jsData = await readLocalJson();
	if (!jsData) {
		document.getElementById('badge').innerText = '0条记录';
		return;
	}

	const todayMMDD = getTodayMMDD();
	const today_eew = [];

	// 3. 一次性筛选，避免多次操作DOM
	for (let i = 0; i < jsData.length; i++) {
		if (!jsData[i].time) {
			console.warn(`第${i}条数据缺少time字段，已跳过`);
			continue;
		}

		// 4. 复用正则表达式
		const matchResult = jsData[i].time.match(DATE_REGEX);

		if (!matchResult) {
			console.warn(`第${i}条数据日期格式错误：${jsData[i].time}，已跳过`);
			continue;
		}

		const month = String(matchResult[2]).padStart(2, '0');
		const day = String(matchResult[3]).padStart(2, '0');

		if (todayMMDD === `${month}-${day}`) {
			today_eew.push(jsData[i]);
		}
	}

	// 5. 显示记录数（保持原逻辑）
	document.getElementById('badge').innerText = `${today_eew.length || 0}条记录`;

	// 6. 批量生成HTML（减少DOM操作）
	if (today_eew && today_eew.length > 0) {
		const container = document.getElementById('Historical_earthquakes');

		// 一次性构建所有HTML
		const htmlParts = today_eew.map(item => {
			const depthText = item.depth == '不明' ? item.depth : item.depth + 'Km';
			return `
                <div class="dz list">
                    <div class="list-header">${item.epicenter}${item.magnitude}级地震</div>
                    <div class="list-details">
                        <p><i class="fas fa-map-marker-alt"></i> 经度: ${item.lng}° 纬度: ${item.lat}°</p>
                        <p><i class="fas fa-clock"></i> 震发时间:${item.time}</p>
                        <p><i class="fa-solid fa-ruler-vertical"></i> 深度:${depthText}</p>
                        <p><i class="fas fa-exclamation-triangle"></i> 最大烈度:${get_maxIntensity(item.magnitude, item.depth)}度</p>
                    </div>
                </div>
            `;
		});

		// 一次性插入
		container.insertAdjacentHTML('afterbegin', htmlParts.join(''));
	}
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initData);
} else {
    initData();
}
