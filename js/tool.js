// ==================== 全局变量和缓存 ====================
let key = null;
let value = null;

// 缓存常用DOM元素
const DOM_CACHE = {
    dataWindow: null,
    zhezhao: null,
    setupWindows: null,
    contextMenu_eew: null,
    contextMenu_qx: null,
    contextMenu_tf: null,
    get: function(selector) {
        if (!this[selector]) {
            this[selector] = document.querySelector(selector);
        }
        return this[selector];
    }
};

// 缓存计算结果
const INTENSITY_CACHE = new Map();
const DISTANCE_CACHE = new Map();
const HEIGHT_CACHE = new Map();

// ==================== 事件委托 ====================
document.addEventListener('click', function(event) {
    // 1. 关闭按钮
    const xmark = event.target.closest('.xmark');
    if (xmark) {
        const dataWindow = DOM_CACHE.get('dataWindow') || document.querySelector('.dataWindow');
        const zhezhao = DOM_CACHE.get('zhezhao') || document.querySelector('.zhezhao');

        if (dataWindow) {
            dataWindow.innerHTML = '';
            dataWindow.classList.remove('active');
        }
        if (zhezhao) {
            zhezhao.classList.add('active');
        }
        return;
    }

    // 2. Card展开/收起
    const cardHead = event.target.closest('.card-head');
    if (cardHead) {
        const cardBody = cardHead.nextElementSibling;
        const toggleIcon = cardHead.querySelector('.toggle-icon');

        if (!cardBody || !cardBody.classList.contains('card-body')) {
            console.error('未找到对应的.card-body元素');
            return;
        }

        const isExpanded = cardBody.classList.contains('active');

        if (isExpanded) {
            // 收起
            cardBody.style.height = '0px';
            cardBody.classList.remove('active');
            toggleIcon?.classList.remove('active');
        } else {
            // 展开：动态高度，不超过最大值
            const cssMaxHeight = parseFloat(getComputedStyle(cardBody).maxHeight) || 27 * 16;
            const contentHeight = cardBody.scrollHeight;
            const targetHeight = Math.min(contentHeight, cssMaxHeight);

            cardBody.style.height = targetHeight + 'px';
            cardBody.classList.add('active');
            toggleIcon?.classList.add('active');

            // 智能滚动条
            if (contentHeight > cssMaxHeight) {
                cardBody.style.overflowY = 'auto';
            } else {
                cardBody.style.overflowY = 'hidden';
            }
        }
        return;
    }

    // 3. EEW图标切换
    const toggleIcon = event.target.closest('.eew-title .toggle-icon');
    if (toggleIcon) {
        const eewContainer = toggleIcon.closest('.eews');
        if (eewContainer) {
            const isActive = eewContainer.classList.toggle('active');
            toggleIcon.classList.toggle('active', isActive);
        }
        return;
    }

    // 4. Setup/Off按钮
    const setupBtn = event.target.closest('#setup');
    const offBtn = event.target.closest('#off');

    if (setupBtn) {
        const zhezhao = DOM_CACHE.get('zhezhao') || document.querySelector('.zhezhao');
        const setupWindows = DOM_CACHE.get('setupWindows') || document.querySelector('.SetupWindows');

        if (zhezhao) zhezhao.classList.remove('active');
        if (setupWindows) setupWindows.style.display = "flex";
        return;
    }

    if (offBtn) {
        const zhezhao = DOM_CACHE.get('zhezhao') || document.querySelector('.zhezhao');
        const setupWindows = DOM_CACHE.get('setupWindows') || document.querySelector('.SetupWindows');

        if (zhezhao) zhezhao.classList.add('active');
        if (setupWindows) setupWindows.style.display = "none";
        return;
    }

    // 5. 点击其他地方隐藏右键菜单
    hideContextMenu();
});

// 右键菜单
document.addEventListener('contextmenu', function(event) {
    const target = event.target.closest('div[data-eew], div[data-cenc], div[data-tf], div[data-qx]');
    if (!target) return;

    event.preventDefault();
    const targetData = target.dataset;
    const keys = Object.keys(targetData);

    if (keys.length > 0) {
        key = keys[0];
        value = targetData[key];
    }

    const menuType = target.hasAttribute('data-eew') || target.hasAttribute('data-cenc') ?
        'contextMenu_eew' : target.hasAttribute('data-tf') ? 'contextMenu_tf' : 'contextMenu_qx';

    showContextMenu(event.pageX, event.pageY, targetData, menuType);
});

document.addEventListener('click', function(event) {
    const menu = event.target.closest('.context-menu');
    if (!menu) return;

    const clickedItem = event.target;

    if (clickedItem.classList.contains('Detailed')) {
        handleDetailedClick();
    } else if (clickedItem.classList.contains('Replay')) {
        console.log('回放:', key, value);
    } else {
        console.log('聚焦:', key, value);
    }
});

// ==================== 核心函数 ====================
function getDomHeightWithPx(dom, type = 'offset') {
    if (!(dom instanceof HTMLElement)) {
        throw new Error('请传入有效的DOM元素');
    }

    const cacheKey = `${dom.className}-${type}`;
    if (HEIGHT_CACHE.has(cacheKey)) {
        return HEIGHT_CACHE.get(cacheKey);
    }

    let height;
    switch (type) {
        case 'offset': height = dom.offsetHeight; break;
        case 'client': height = dom.clientHeight; break;
        case 'scroll': height = dom.scrollHeight; break;
        default: throw new Error('无效的高度类型');
    }

    const result = `${height}px`;
    HEIGHT_CACHE.set(cacheKey, result);
    return result;
}

function showContextMenu(x, y, targetData, contextMenuId) {
    let contextMenu = DOM_CACHE.get(contextMenuId);
    if (!contextMenu) {
        contextMenu = document.getElementById(contextMenuId);
        if (contextMenu) {
            DOM_CACHE[contextMenuId] = contextMenu;
        }
    }

    if (!contextMenu) return;

    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.setAttribute('data-target-id', JSON.stringify(targetData));
    contextMenu.classList.add('active');
}

function hideContextMenu() {
    const menus = [
        DOM_CACHE.get('contextMenu_eew') || document.getElementById('contextMenu_eew'),
        DOM_CACHE.get('contextMenu_qx') || document.getElementById('contextMenu_qx'),
        DOM_CACHE.get('contextMenu_tf') || document.getElementById('contextMenu_tf')
    ];

    menus.forEach(menu => {
        if (menu) menu.classList.remove('active');
    });
}

function handleDetailedClick() {
    const dataWindow = DOM_CACHE.get('dataWindow') || document.querySelector('.dataWindow');
    const zhezhao = DOM_CACHE.get('zhezhao') || document.querySelector('.zhezhao');

    if (!dataWindow || !zhezhao) return;

    let html = '';
    if (key === 'eew' || key === 'cenc') {
        html = dz_dom();
    } else if (key === 'tf' || key === 'nowtf') {
        html = tf_dom();
    } else {
        html = qx_dom();
    }

    dataWindow.innerHTML = html;
    dataWindow.classList.add('active');
    zhezhao.classList.remove('active');
}

// ==================== 烈度计算（带缓存） ====================
function get_maxIntensity(magnitude, depth) {
    if (typeof magnitude !== "number") magnitude = Number(magnitude);
    if (typeof depth !== "number" || depth === 0) depth = 10;

    const cacheKey = `${magnitude}-${depth}`;
    if (INTENSITY_CACHE.has(cacheKey)) {
        return INTENSITY_CACHE.get(cacheKey);
    }

    let result;
    if (depth <= 40) {
        result = (0.24 + 1.29 * magnitude).toFixed(1);
    } else {
        result = (1.5 * magnitude - 3.5 * Math.log10(depth) + 4.5).toFixed(1);
    }

    INTENSITY_CACHE.set(cacheKey, result);
    return result;
}

function liedu_fansuan(magnitude, depth) {
    if (typeof magnitude !== "number") {
        magnitude = Number(magnitude);
    }

    const cacheKey = `${magnitude}-${depth}`;
    if (DISTANCE_CACHE.has(cacheKey)) {
        return DISTANCE_CACHE.get(cacheKey);
    }

    const color = [
        '#E3F2FD', '#00BCD4', '#2ECC71', '#6AB045',
        '#B8C400', '#FFB300', '#FF8C00', '#FF4500',
        '#D60000', '#B40000', '#9D00FF', '#800080'
    ];

    let distances = [];
    let colors = [];
    let maxMagnitude = parseFloat(get_maxIntensity(magnitude, depth));

    const startIntensity = Math.max(1, Math.ceil(maxMagnitude - 8));
    const endIntensity = Math.ceil(maxMagnitude);

    for (let j = startIntensity; j <= endIntensity; j++) {
        let distance = calculateDistance(j, magnitude, depth);
        distances.push(distance);
        const colorIndex = Math.min(j - 1, color.length - 1);
        colors.push(color[colorIndex]);
    }

    const result = [distances.reverse(), colors.reverse()];
    DISTANCE_CACHE.set(cacheKey, result);
    return result;

    function calculateDistance(intensity, magnitude, depth) {
        depth = Math.max(Number(depth) || 10, 10);
        const exponent = (1.5 * magnitude - intensity + 2.4) / 3.5;
        const power = Math.pow(10, exponent);
        const distanceSquared = Math.pow(power, 2) - (depth ** 2);
        return distanceSquared < 0 ? 0 : Math.sqrt(distanceSquared);
    }
}

// ==================== 其他保留函数 ====================
function dz_dom(data = ['', '', '', '', '', '', '', '', '', '', '', '', '', '']) {
    return `<div class="window-header header-red">
                <span class="title">地震详细信息</span>
                <button class="xmark">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="window-body">
                <div class="window-title window-title-red ">
                    <div class="data-item">
                        <span class="data-item-label_top red">${data[0]}M5.2</span>
                        <span class="data-item-value">震级(M)</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">${data[1]}浅源地震</span>
                        <span class="data-item-value">地震类型</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">${data[2]}Ⅹ度</span>
                        <span class="data-item-value">最大烈度</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">${data[3]}50公里内</span>
                        <span class="data-item-value">影响范围</span>
                    </div>
                    <div class="data-item">
                        <img src="${data[4]}./img/svg/红色.svg" alt="" style="height: 7vw;aspect-ratio: 1 / 1;" id="img" />
                    </div>
                </div>
                <div class="window-center">
                    <div class="data-item-q">
                        <div class="data-item-json">
                            <span class="label">参考位置</span>
                            <div class="data-item-megass">${data[5]}加罗林群岛</div>
                        </div>
                        <div class="data-item-json">
                            <span class="label">本地烈度</span>
                            <div class="data-item-megass">${data[6]}Ⅷ度</div>
                        </div>
                        <div class="data-item-json">
                            <span class="label">震发时间</span>
                            <div class="data-item-megass">${data[7]}2025-10-13 19:11:01</div>
                        </div>
                        <div class="data-item-json">
                            <span class="label">震源深度</span>
                            <div class="data-item-megass">${data[8]}10Km</div>
                        </div>
                    </div>
                    <div class="data-item-q">
                        <div class="data-item-json">
                            <span class="label">经纬度</span>
                            <div class="data-item-megass">${data[9]}30°15'20"N 120°30'15"E</div>
                        </div>
                        <div class="data-item-json">
                            <span class="label">数据来源</span>
                            <div class="data-item-megass">${data[10]}成都高新减灾研究所</div>
                        </div>
                        <div class="data-item-json">
                            <span class="label">预警时间</span>
                            <div class="data-item-megass">${data[11]}32秒</div>
                        </div>
                        <div class="data-item-json">
                            <span class="label">震中距</span>
                            <div class="data-item-megass">${data[12]}135Km</div>
                        </div>
                    </div>
                </div>
            </div>`;
}

function qx_dom() {
    return `<div class="window-header header-red">
                <span class="title">气象详细信息</span>
                <span class="title-qx">新疆维吾尔自治区伊犁哈萨克自治州塔城地区和布克赛尔蒙古自治县</span>
                <button class="xmark">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="window-body">
                <div class="window-title window-title-red">
                    <div class="data-item">
                        <span class="data-item-label_top red">高温</span>
                        <span class="data-item-value">预警类型</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">2025-10-25 12:33</span>
                        <span class="data-item-value">发布时间</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">红色预警</span>
                        <span class="data-item-value">预警等级</span>
                    </div>
                    <div class="data-item">
                        <img src="./img/qx-img/冰雹黄色.svg" alt="" style="height: 7vw;" />
                    </div>
                </div>
                <div class="window-center qx">
                    <div class="data-item-q">
                        <div class="data-item-json qx">
                            <span class="label">预警详细</span>
                            <div class="data-item-megass">
                                庆城县气象台2025年10月23日17时05分发布大雾黄色预警信号：预计今天夜间到明天上午，我县县城、驿马、马岭、三十里铺、玄马、桐川、白马、赤城、高楼、蔡家庙、太白梁、土桥、蔡口集、翟家河、南庄等乡镇部分地方将出现大雾，可能对交通或农牧业等有影响。请注意防范！
                            </div>
                        </div>
                    </div>
                    <div class="data-item-q">
                        <div class="data-item-json qx">
                            <span class="label">防御指南</span>
                            <div class="data-item-megass">
                                1. 有关部门和单位按照职责做好防需准备工作；
                                2.机场、高速公路、轮渡码头等单位加强交通管理，
                                保障安全；
                                3.驾驶人员注意雾的变化，小心驾驶；
                                4.户外活动注意安全</div>
                        </div>
                    </div>
                </div>
            </div>`;
}

function tf_dom() {
    return `<div class="window-header header-red">
                <span class="title">台风详细信息</span>
                <button class="xmark">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="window-body">
                <div class="window-title window-title-red">
                    <div class="data-item">
                        <span class="data-item-label_top red">桦加沙</span>
                        <span class="data-item-value">台风名</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">超强台风</span>
                        <span class="data-item-value">当前等级</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">超强台风</span>
                        <span class="data-item-value">最大等级</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">2025-11-02 22:00</span>
                        <span class="data-item-value">发布时间</span>
                    </div>
                    <div class="data-item">
                        <span class="data-item-label">202525号</span>
                        <span class="data-item-value">台风编号</span>
                    </div>
                </div>
                <div class="window-center">
                    <div class="data-item-q">
                        <div class="data-item-json tf">
                            <span class="label">当前位置</span>
                            <div class="data-item-megass">
                                台湾省西南130Km左右
                            </div>
                        </div>
                        <div class="data-item-json tf">
                            <span class="label">未来趋势</span>
                            <div class="data-item-megass">
                                西北方向130Km
                            </div>
                        </div>
                        <div class="data-item-json tf">
                            <span class="label">移速移向</span>
                            <div class="data-item-megass">
                                20公里/小时，西西北
                            </div>
                        </div>
                        <div class="data-item-json tf">
                            <span class="label">风速风力</span>
                            <div class="data-item-megass">
                                15米/秒，8级
                            </div>
                        </div>
                    </div>
                    <div class="data-item-q">
                        <div class="data-item-json tf">
                            <span class="label">7级半径</span>
                            <div class="data-item-megass">
                                340-480Km
                            </div>
                        </div>
                        <div class="data-item-json tf">
                            <span class="label">10级半径</span>
                            <div class="data-item-megass">
                                160-200Km
                            </div>
                        </div>
                        <div class="data-item-json tf">
                            <span class="label">12级半径</span>
                            <div class="data-item-megass">
                                80-120Km
                            </div>
                        </div>
                        <div class="data-item-json tf">
                            <span class="label">中心气压</span>
                            <div class="data-item-megass">
                                915百帕
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
}

function getCirclePoints(lat, lon, radius, points = 70) {
    const earthRadius = 6371;
    const toRadian = (deg) => deg * Math.PI / 180;
    const toDegree = (rad) => rad * 180 / Math.PI;

    const centerLat = toRadian(lat);
    const centerLon = toRadian(lon);
    const angularRadius = radius / earthRadius;

    const coordinates = [];
    let prevLonDegree;

    for (let i = 0; i <= points; i++) {
        const bearing = toRadian((i * 360) /            Math.sin(centerLat) * Math.cos(angularRadius) +
            Math.cos(centerLat) * Math.sin(angularRadius) * Math.cos(bearing)
        );
        let lonRadian = centerLon + Math.atan2(
            Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(centerLat),
            Math.cos(angularRadius) - Math.sin(centerLat) * Math.sin(latRadian)
        );

        const latDegree = Math.max(-90, Math.min(90, toDegree(latRadian)));
        let lonDegree = toDegree(lonRadian);

        if (i > 0) {
            const delta = lonDegree - prevLonDegree;
            if (delta > 180) {
                lonDegree -= 360;
            } else if (delta < -180) {
                lonDegree += 360;
            }
        }

        lonDegree = ((lonDegree + 180) % 360) - 180;
        coordinates.push([lonDegree, latDegree]);
        prevLonDegree = lonDegree;
    }

    coordinates[coordinates.length - 1] = [...coordinates[0]];
    return coordinates;
}

function darkMode() {
    let n = document.body.classList.toggle("dark-mode");
    const manual = document.getElementById("manual-mode");
    const time = document.getElementById("time-mode");
    const system = document.getElementById("system-mode");

    if (n) {
        if (manual) manual.disabled = false;
        if (time) time.disabled = false;
        if (system) system.disabled = false;
    } else {
        if (manual) manual.disabled = true;
        if (time) time.disabled = true;
        if (system) system.disabled = true;
    }
}

function OnToOff() {
    const mapboxKey = document.getElementById('MapboxKey');
    if (mapboxKey) mapboxKey.classList.toggle("time");
}

function on_off_time(t) {
    const seTime = document.getElementById('se-time');
    if (!seTime) return;

    if (t == 'manual-mode') {
        seTime.classList.add("time");
    } else if (t == 'time-mode') {
        seTime.classList.remove("time");
    } else {
        seTime.classList.add("time");
    }
}
