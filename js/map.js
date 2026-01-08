// ==================== 配置和全局变量 ====================
// 替换为你的 Mapbox Token
mapboxgl.accessToken = 'pk.eyJ1IjoiODc4NjY1NjAwIiwiYSI6ImNtOWllZTY4ZjAxOHUyanNrdDg3MXgwbjMifQ.NLR7E5FsPxORHPcjs67lSQ';

// 优化：使用对象而非字符串，避免类型错误
let circleFeatures = {
	type: 'FeatureCollection',
	features: []
};
let insty = {
	type: 'FeatureCollection',
	features: []
};

// 优化：使用Map存储数据，便于管理和更新
const citypointMap = new Map();

// 优化：缓存GeoJSON数据，避免重复解析
let cachedCityData = null;
let cachedProvinceData = null;

// 优化：记录已添加的图层，避免重复添加
const addedLayers = new Set();

// ==================== 地图初始化 ====================
// 创建地图实例
const map = new mapboxgl.Map({
	container: 'map',
	style: 'mapbox://styles/mapbox/dark-v11',
	center: [105, 35],
	zoom: 1.5,
	projection: 'globe',
	collectResourceTiming: false,
	attributionControl: false,
	trackResize: false
})
// 优化：防抖的resize
let resizeTimeout;
window.addEventListener('resize', () => {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		map.resize();
	}, 250);
});

// 添加中文控件
map.addControl(new MapboxLanguage({
	defaultLanguage: 'zh-Hans'
}));

// ==================== 地图加载完成后的处理 ====================
map.on('load', async () => {
	try {
		// 1. 优化地图样式调整（只执行一次）
		await adjustMapStyle();

		// 2. 并行加载数据（提升速度）
		const [cityData, provinceData] = await Promise.all([
			fetchAndCache('./img/100000_full_city.json', 'city'),
			fetchAndCache('./img/100000_full.json', 'province')
		]);

		// 3. 处理数据并添加图层
		await processDataAndLayers(cityData, provinceData);

		console.log('地图初始化完成');
	} catch (error) {
		console.error('地图加载失败:', error);
		showErrorMessage('地图初始化失败，请刷新重试');
	}
});

// ====================优化后的函数 ====================

// 1. 优化：调整地图样式（只隐藏不需要的图层）
async function adjustMapStyle() {
	const keepLayers = [
		'land', 'water',
		'admin-0-boundary', 'admin-0-boundary-bg',
		'admin-1-boundary', 'admin-1-boundary-bg'
	];

	//优化：只遍历一次，批量操作
	const layers = map.getStyle().layers;
	const hideOperations = [];

	for (const layer of layers) {
		if (!keepLayers.includes(layer.id)) {
			hideOperations.push(layer.id);
		}
	}

	// 批量隐藏图层
	hideOperations.forEach(layerId => {
		try {
			map.setLayoutProperty(layerId, 'visibility', 'none');
		} catch (e) {
			//忽略不存在的图层
		}
	});

	// 设置中国国界线过滤
	const adminLayers = ['admin-0-boundary'];
	adminLayers.forEach(layerId => {
		try {
			map.setFilter(layerId, [
				"match", ["get", "worldview"],
				["all", "CN"], true, false
			]);
		} catch (e) {
			console.warn(`边界过滤失败: ${layerId}`, e.message);
		}
	});

	// 自定义颜色
	try {
		map.setPaintProperty('land', 'background-color', '#4b5764');
		map.setPaintProperty('admin-0-boundary', 'line-color', '#212121');
		map.setPaintProperty('admin-0-boundary-bg', 'line-color', '#4b5764');
		map.setPaintProperty('admin-1-boundary', 'line-color', '#212121');
		map.setPaintProperty('admin-1-boundary-bg', 'line-color', '#212121');
		map.setPaintProperty('water', 'fill-color', '#94acac');

		map.setFog({
			range: [-1, 10],
			color: "#00041f",
			"high-color": "#000a4b",
			"space-color": "#00062a",
			"horizon-blend": 0.1,
			"star-intensity": 1
		});
	} catch (e) {
		console.warn('样式设置失败:', e.message);
	}
}

// 2. 优化：带缓存的数据获取
async function fetchAndCache(url, type) {
	// 检查内存缓存
	if (type === 'city' && cachedCityData) return cachedCityData;
	if (type === 'province' && cachedProvinceData) return cachedProvinceData;

	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();

		// 缓存数据
		if (type === 'city') cachedCityData = data;
		if (type === 'province') cachedProvinceData = data;

		return data;
	} catch (error) {
		console.error(`获取${type === 'city' ? '城市' : '省份'}数据失败:`, error);
		throw error;
	}
}

// 3. 优化：处理数据并添加图层
async function processDataAndLayers(cityData, provinceData) {
	// 1. 建立城市坐标索引（只执行一次）
	if (citypointMap.size === 0) {
		cityData.features.forEach(feature => {
			const name = feature.properties?.name;
			const center = feature.properties?.center;
			const coordinates = feature.geometry?.coordinates;
			if (name && coordinates) {
				citypointMap.set(name, coordinates);
			}
		});
	}

	// 2. 批量创建GeoJSON（优化内存）
	const cityGeoJson = {
		type: 'FeatureCollection',
		features: cityData.features
			.filter(f => f.properties?.name && f.properties?.center)
			.map(f => ({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: f.properties.center
				},
				properties: {
					name: f.properties.name
				}
			}))
	};

	const provinceGeoJson = {
		type: 'FeatureCollection',
		features: provinceData.features
			.filter(f => {
				const props = f.properties;
				return props?.name && (props?.centroid || props?.center);
			})
			.map(f => ({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: f.properties.centroid || f.properties.center
				},
				properties: {
					name: f.properties.name
				}
			}))
	};

	// 3. 添加数据源（检查是否存在）
	await addSourceIfNotExists('province-area-centers', provinceGeoJson);
	await addSourceIfNotExists('area-centers', cityGeoJson);
	await addSourceIfNotExists('circle-data', circleFeatures);
	await addSourceIfNotExists('insty-data', insty);

	// 4. 批量添加图层
	const layers = [{
			id: 'center-dots',
			type: 'circle',
			source: 'area-centers',
			filter: ['all', ['>=', ['zoom'], 4.5],
				['<', ['zoom'], 18]
			],
			paint: {
				'circle-radius': 3,
				'circle-color': '#cfcfcf',
				'circle-opacity': 1
			}
		},
		{
			id: 'area-names',
			type: 'symbol',
			source: 'area-centers',
			filter: ['all', ['>=', ['zoom'], 4.5],
				['<', ['zoom'], 18]
			],
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Microsoft YaHei', 'Arial Unicode MS', 'sans-serif'],
				'text-size': 12,
				'text-offset': [0, -0.5],
				'text-anchor': 'bottom'
			},
			paint: {
				'text-color': '#ffffff',
				'text-opacity': 1
			}
		},
		{
			id: 'province-area-names',
			type: 'symbol',
			source: 'province-area-centers',
			filter: ['all', ['>=', ['zoom'], 2.5],
				['<', ['zoom'], 7]
			],
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Microsoft YaHei', 'Arial Unicode MS', 'sans-serif'],
				'text-size': 12,
				'text-offset': [0, 0],
				'text-anchor': 'bottom'
			},
			paint: {
				'text-color': '#080808',
				'text-opacity': 1
			}
		},
		{
			id: 'insty-fill',
			type: 'fill',
			source: 'insty-data',
			paint: {
				'fill-color': ['get', 'fillColor'],
				'fill-opacity': 0.5
			}
		},
		{
			id: 'circle-stroke',
			type: 'line',
			source: 'circle-data',
			paint: {
				'line-color': ['get', 'strokeColor'],
				'line-width': 2
			}
		}
	];

	for (const layer of layers) {
		await addLayerIfNotExists(layer);
	}
}

// 4. 优化：添加数据源（检查是否存在）
function addSourceIfNotExists(id, data) {
	return new Promise((resolve) => {
		if (map.getSource(id)) {
			map.getSource(id).setData(data);
			resolve();
		} else {
			map.addSource(id, {
				type: 'geojson',
				data
			});
			resolve();
		}
	});
}

// 5. 优化：添加图层（检查是否存在）
function addLayerIfNotExists(layerConfig) {
	return new Promise((resolve, reject) => {
		if (map.getLayer(layerConfig.id)) {
			resolve();
			return;
		}

		try {
			map.addLayer(layerConfig);
			addedLayers.add(layerConfig.id);
			resolve();
		} catch (error) {
			console.error(`添加图层失败: ${layerConfig.id}`, error);
			reject(error);
		}
	});
}

// 6. 优化：批量添加烈度数据（核心优化）
function add_insty_data(e) {
	if (!Array.isArray(e) || e.length === 0) {
		console.warn('add_insty_data: 输入数据为空或格式错误');
		return;
	}

	// 优化：预分配数组，减少内存分配
	const features = new Array(e.length);

	for (let i = 0; i < e.length; i++) {
		const item = e[i];
		const name = item[0];
		const color = item[1];

		const coordinates = citypointMap.get(name);
		if (!coordinates) {
			console.warn(`未找到城市坐标: ${name}`);
			continue;
		}

		features[i] = {
			type: "Feature",
			properties: {
				fillColor: color,
				strokeColor: "rgba(0,0,0,0)"
			},
			geometry: {
				type: "MultiPolygon",
				coordinates: coordinates
			}
		};
	}

	// 优化：批量更新，只调用一次setData
	const source = map.getSource('insty-data');
	if (source) {
		source.setData({
			type: 'FeatureCollection',
			features: features.filter(f => f) // 过滤掉无效的
		});
	} else {
		console.error('insty-data 数据源不存在');
	}
}

// 7. 优化：错误提示
function showErrorMessage(message) {
	const container = document.getElementById('map');
	if (container) {
		container.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        color: #ff6b6b; text-align: center; background: rgba(0,0,0,0.8);
                        padding: 20px; border-radius: 8px; z-index: 9999;">
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 15px; cursor: pointer;">刷新页面</button>
            </div>
        `;
	}
}

// 8. 优化：清理函数（防止内存泄漏）
function cleanupMap() {
	// 移除事件监听器
	map.off('load');

	// 清理缓存
	cachedCityData = null;
	cachedProvinceData = null;
	citypointMap.clear();

	// 移除数据源和图层（如果需要）
	// 注意：Mapbox会自动清理，但如果有自定义资源需要手动清理
}