let currentPeriod = '7d';
let earthquakeData = null; // 存储原始接口数据（缓存用）
let earthquakeChart = null;
let handle_data = null; // 存储筛选后的数据（供图表使用）
let currentRegion = 'global'; // 记录当前选中的地区（默认全球，用于标题/筛选）
const provinceArr = [
    '北京', '天津', '上海', '重庆', '河北', '河南', '山东', '山西', '湖北', '湖南', '广东', '广西', '福建', '黑龙江', '吉林', '辽宁',
    '内蒙古', '陕西', '宁夏', '甘肃', '新疆', '青海', '西藏', '贵州', '四川', '云南', '江西', '江苏',
    '浙江', '台湾', '海南', '香港', '澳门', '安徽'
];

// 1. 修复：处理 e.province 空值 + 优化筛选逻辑
function handle(earthquakeData, regionFilter = 'global') {
    currentRegion = regionFilter; // 更新当前地区

    if (!earthquakeData || !Array.isArray(earthquakeData)) {
        handle_data = [];
        eew_Chart();
        return;
    }

    switch (regionFilter) {
        case 'global':
            handle_data = earthquakeData;
            break;
        case 'domestic':
            handle_data = earthquakeData.filter(e => {
                if (!e.location) return false;
                const currentProvince = (e.location.slice(0, 2) || '').trim();
                return provinceArr.includes(currentProvince);
            });
            break;
        case 'foreign':
            handle_data = earthquakeData.filter(e => {
                if (!e.location) return true;
                const currentProvince = (e.location.slice(0, 2) || '').trim();
                return !provinceArr.includes(currentProvince);
            });
            break;
    }
    eew_Chart(); // 筛选后更新图表
}

// 防抖函数（保留）
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// 时间格式转换（增强错误处理）
function convertToTimeZoneDate(timeInput, timeZone = '+8') {
    let date;
    try {
        if (timeInput instanceof Date) date = new Date(timeInput);
        else if (typeof timeInput === 'number') {
            date = new Date(timeInput.toString().length <= 10 ? timeInput * 1000 : timeInput);
        } else if (typeof timeInput === 'string') {
            const parsed = parseInt(timeInput);
            date = isNaN(parsed) ? new Date(timeInput) : new Date(parsed);
        } else {
            throw new Error('不支持的时间输入类型');
        }

        if (isNaN(date.getTime())) throw new Error(`无法解析的时间格式: ${timeInput}`);

        const timeZoneOffset = parseInt(timeZone, 10);
        if (isNaN(timeZoneOffset)) throw new Error(`无效的时区格式: ${timeZone}`);

        const inputTimeTimestamp = date.getTime();
        const utcTimestamp = inputTimeTimestamp - (timeZoneOffset * 3600 * 1000);
        const beijingTimestamp = utcTimestamp + (8 * 3600 * 1000);
        const beijingTime = new Date(beijingTimestamp);

        const year = beijingTime.getFullYear();
        const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
        const day = String(beijingTime.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('时间转换错误:', error, timeInput);
        return '未知时间';
    }
}

// 2. 修复：将 initOrUpdateChart 移到全局作用域
function initOrUpdateChart(period = '7d') {
    const chartContainer = document.getElementById('d3');
    if (!chartContainer) return;

    const ctx = chartContainer.getContext('2d');
    if (!ctx) return;

    // 生成图表数据
    const chartData = generateChartData(period);

    // 3. 修复：图表更新逻辑（避免重复创建）
    if (earthquakeChart) {
        // 更新现有图表
        earthquakeChart.data = chartData;
        earthquakeChart.update();
    } else {
        // 创建新图表
        const regionText = currentRegion === 'domestic' ? '国内' : currentRegion === 'foreign' ? '国外' : '全球';
        const periodText = period === '7d' ? '7天' : period === '30d' ? '30天' : '12月';

        earthquakeChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { font: { family: 'Kingsoft_Cloud_Font' } }
                    },
                    title: {
                        display: true,
                        text: `${regionText}地震数量统计（${periodText}）(数据来源于中国地震台网中心)`,
                        font: { family: 'Kingsoft_Cloud_Font', weight: 200 }
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        grid: { display: false },
                        title: {
                            display: true,
                            text: '时间范围',
                            font: { family: 'Kingsoft_Cloud_Font' }
                        }
                    },
                    y: {
                        stacked: false,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0,
                            font: { family: 'Kingsoft_Cloud_Font' }
                        },
                        title: {
                            display: true,
                            text: '地震次数（次）',
                            font: { family: 'Kingsoft_Cloud_Font' }
                        }
                    }
                }
            }
        });
    }
}

// 4. 修复：将分类和生成图表数据的函数移到全局
function classifyEarthquakesByDayAndMagnitude(handle_data, fenlei = 'day') {
    if (!handle_data || handle_data.length === 0) {
        return { day: [], month: [], statsByDay: [], statsByMonth: [] };
    }

    let today = convertToTimeZoneDate(new Date(), '+8');
    let end_day = convertToTimeZoneDate(handle_data[handle_data.length - 1].created_at * 1000, '+8');

    const day = (new Date(today) - new Date(end_day)) / 1000 / 60 / 60 / 24;
    let allArr = {
        'day': [],
        'month': [],
        'statsByDay': [],
        'statsByMonth': []
    };

    if (fenlei === 'day') {
        for (let i = day; i >= 0; i--) {
            let numday = convertToTimeZoneDate(new Date(today) - (1000 * 60 * 60 * 24 * i), '+8');
            allArr.day[numday] = i;
            allArr.statsByDay.push([0, 0, 0, 0]);
        }

        for (let i = 0; i < handle_data.length; i++) {
            let eewday = convertToTimeZoneDate(handle_data[i].created_at * 1000, '+8');
            let mag = +handle_data[i].level;
            let magx = mag >= 7 ? 3 : mag >= 6 ? 2 : mag >= 5 ? 1 : 0;

            if (allArr.day[eewday] !== undefined) {
                allArr.statsByDay[allArr.day[eewday]][magx]++;
            }
        }
    } else {
        const monthsSet = new Set();
        monthsSet.add(today.substring(0, 7));

        handle_data.forEach(item => {
            const itemDate = convertToTimeZoneDate(item.created_at * 1000, '+8');
            monthsSet.add(itemDate.substring(0, 7));
        });

        const monthsArray = Array.from(monthsSet).sort((a, b) => new Date(b) - new Date(a));

        monthsArray.forEach((month, index) => {
            allArr.month[month] = index;
            allArr.statsByMonth.push([0, 0, 0, 0]);
        });

        for (let i = 0; i < handle_data.length; i++) {
            const itemDate = convertToTimeZoneDate(handle_data[i].created_at * 1000, '+8');
            const month = itemDate.substring(0, 7);
            const mag = +handle_data[i].level;
            const magx = mag >= 7 ? 3 : mag >= 6 ? 2 : mag >= 5 ? 1 : 0;

            if (allArr.month[month] !== undefined) {
                allArr.statsByMonth[allArr.month[month]][magx]++;
            }
        }
    }
    return allArr;
}

function generateChartData(period) {
    const data = {
        labels: [],
        datasets: [
            {
                label: '≤4.9级地震',
                backgroundColor: 'rgba(56, 235, 86, 0.7)',
                borderColor: 'rgba(56, 235, 86, 1.0)',
                borderWidth: 1,
                data: []
            },
            {
                label: '5.0-5.9级地震',
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                data: []
            },
            {
                label: '6.0-6.9级地震',
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1,
                data: []
            },
            {
                label: '≥7.0级地震',
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                data: []
            }
        ]
    };

    if (!handle_data || handle_data.length === 0) {
        return data;
    }

    if (period === '7d') {
        let tt = classifyEarthquakesByDayAndMagnitude(handle_data, 'day');
        const recent7Days = tt.statsByDay.slice(0, 7).reverse();
        const recent7Labels = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return `${date.getMonth() + 1}-${date.getDate()}`;
        });

        data.labels = recent7Labels;
        recent7Days.forEach(dayData => {
            data.datasets[0].data.push(dayData[0]);
            data.datasets[1].data.push(dayData[1]);
            data.datasets[2].data.push(dayData[2]);
            data.datasets[3].data.push(dayData[3]);
        });
    } else if (period === '30d') {
        let tt = classifyEarthquakesByDayAndMagnitude(handle_data, 'day');
        const recent30Days = tt.statsByDay.slice(0, 30).reverse();
        const recent30Labels = Array.from({ length: 30 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (29 - i));
            return `${date.getMonth() + 1}-${date.getDate()}`;
        });

        data.labels = recent30Labels;
        recent30Days.forEach(dayData => {
            data.datasets[0].data.push(dayData[0]);
            data.datasets[1].data.push(dayData[1]);
            data.datasets[2].data.push(dayData[2]);
            data.datasets[3].data.push(dayData[3]);
        });
    } else if (period === '12m') {
        let tt = classifyEarthquakesByDayAndMagnitude(handle_data, 'month');
        const recent12Months = tt.statsByMonth.slice(0, 12).reverse();
        const recent12Labels = Array.from({ length: 12 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - (11 - i));
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        });

        data.labels = recent12Labels;
        recent12Months.forEach(monthData => {
            data.datasets[0].data.push(monthData[0]);
            data.datasets[1].data.push(monthData[1]);
            data.datasets[2].data.push(monthData[2]);
            data.datasets[3].data.push(monthData[3]);
        });
    }
    return data;
}

// 5. 修复：eew_Chart 函数简化，专注于数据检查和调用图表更新
function eew_Chart() {
    const chartContainer = document.getElementById('d3');
    if (!chartContainer) return;

    // 空数据处理
    if (!handle_data || !Array.isArray(handle_data)) {
        chartContainer.textContent = '加载地震数据中...';
        return;
    }

    if (handle_data.length === 0) {
        chartContainer.textContent = '暂无匹配的地震数据';
        // 清理图表
        if (earthquakeChart) {
            earthquakeChart.destroy();
            earthquakeChart = null;
        }
        return;
    }

    // 有数据则更新/创建图表
    initOrUpdateChart(currentPeriod);
}

// 6. 修复：fetch_data 函数增强错误处理
function fetch_data() {
    const chartContainer = document.getElementById('d3');
    if (chartContainer) {
        chartContainer.textContent = '加载地震数据中...';
    }

    fetch('https://yjfw.cenc.ac.cn/api/earthquake/event/v1/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
            alarm_type: 1,
            page_query: { page_no: 1, page_size: 1100 },
            app_id: 'dkcxbftqof0h',
            _t: Date.now()
        })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    })
    .then(data => {
        // 安全访问数据
        if (data && data.data && Array.isArray(data.data.spot_infos)) {
            earthquakeData = data.data.spot_infos;
            handle(earthquakeData, currentRegion);
        } else {
            throw new Error('API返回的数据结构无效');
        }
    })
    .catch(error => {
        console.error('数据请求/处理失败:', error);
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="color: #ff6b6b; text-align: center; padding: 20px;">
                    <p>数据加载失败: ${error.message}</p>
                    <button id="retryBtn" class="btn" style="margin-top: 10px;">重新加载</button>
                </div>
            `;
            // 绑定重试事件
            const retryBtn = document.getElementById('retryBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', debouncedGetcencdata);
            }
        }
    });
}

// 7. 修复：事件绑定优化 - 确保在DOM加载后绑定，并检查元素存在
function bindEvents() {
    // 时间筛选按钮
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            // 防止重复绑定
            if (!btn.dataset.bound) {
                btn.addEventListener('click', function() {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    currentPeriod = this.dataset.period;
                    if (handle_data && Array.isArray(handle_data) && handle_data.length > 0) {
                        initOrUpdateChart(currentPeriod); // 仅更新图表
                    }
                });
                btn.dataset.bound = 'true';
            }
        });
    }

    // 地区下拉框
    const regionSelect = document.getElementById('regionFilter');
    if (regionSelect && !regionSelect.dataset.bound) {
        regionSelect.addEventListener('change', function() {
            const selectedRegion = this.value;
            if (earthquakeData && Array.isArray(earthquakeData)) {
                handle(earthquakeData, selectedRegion);
            } else {
                debouncedGetcencdata();
            }
        });
        regionSelect.dataset.bound = 'true';
    }

    // 刷新按钮
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.addEventListener('click', function() {
            const chartContainer = document.getElementById('d3');
            if (chartContainer) chartContainer.textContent = '刷新数据中...';
            debouncedGetcencdata();
        });
        refreshBtn.dataset.bound = 'true';
    }
}

// 初始化防抖请求
const debouncedGetcencdata = debounce(fetch_data, 500);

// 8. 修复：页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    bindEvents();
    debouncedGetcencdata();
});
