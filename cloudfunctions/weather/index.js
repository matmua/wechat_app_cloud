const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const COL_USERS = 'users';
const COL_COUPLES = 'couples';
const COL_LOCATIONS = 'partner_locations';

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function sanitizeString(value, maxLen = 128) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (res.statusCode >= 400 || data.error) {
            reject(new Error(data.reason || data.message || `天气服务请求失败：${res.statusCode}`));
            return;
          }
          resolve(data);
        } catch (e) {
          reject(new Error('天气服务返回格式异常'));
        }
      });
    }).on('error', reject);
  });
}

function getWeatherProvider() {
  const provider = sanitizeString(process.env.WEATHER_PROVIDER, 24).toLowerCase();
  return provider === 'qweather' ? 'qweather' : 'openmeteo';
}

function hasCoordinates(location = {}) {
  return location.latitude !== undefined &&
    location.latitude !== null &&
    location.longitude !== undefined &&
    location.longitude !== null &&
    location.latitude !== '' &&
    location.longitude !== '';
}

function formatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}.${day} ${hour}:${minute}`;
}

function careTip(now = {}, target = 'partner') {
  const temp = Number(now.temp);
  const text = now.text || '';
  const isSelf = target === 'self';
  if (text.includes('雨')) return isSelf ? '你这里可能下雨，出门记得带伞。' : 'Ta 那里可能下雨，记得提醒 Ta 带伞，路上慢一点。';
  if (!Number.isNaN(temp) && temp <= 10) return isSelf ? '你这里有点冷，别忘了加衣服。' : 'Ta 那里有点冷，记得提醒 Ta 加衣服，别硬扛。';
  if (!Number.isNaN(temp) && temp >= 30) return isSelf ? '你这里有点热，多喝水，少晒太阳。' : 'Ta 那里有点热，提醒 Ta 多喝水，少晒太阳。';
  if (text.includes('雪')) return isSelf ? '你这里可能下雪，出门注意路滑。' : 'Ta 那里可能下雪，出门要注意路滑。';
  return isSelf ? '你这里天气还算温柔，适合好好过今天。' : 'Ta 那里的天气还算温柔，可以问问今天有没有看到好看的天空。';
}

function weatherCodeText(code) {
  const value = Number(code);
  if (value === 0) return '晴';
  if (value === 1 || value === 2) return '多云';
  if (value === 3) return '阴';
  if (value === 45 || value === 48) return '雾';
  if ([51, 53, 55, 56, 57, 61, 80].includes(value)) return '小雨';
  if ([63, 66, 67, 81].includes(value)) return '中雨';
  if ([65, 82].includes(value)) return '大雨';
  if ([71, 73, 75, 77, 85, 86].includes(value)) return '雪';
  if ([95, 96, 99].includes(value)) return '雷雨';
  return '未知天气';
}

function serviceUnavailableWeather(location, target = 'partner', provider = 'qweather') {
  return {
    provider,
    city: location.city || (target === 'self' ? '我的位置' : '对方的位置'),
    temp: '--',
    condition: '暂未配置',
    feelsLike: '--',
    windSpeed: '',
    windDir: '',
    windScale: '',
    humidity: '',
    obsTime: '',
    updatedText: formatTime(location.updatedAt),
    weatherCode: '',
    serviceMessage: '天气服务暂未配置',
    tip: '天气服务暂未配置，稍后再看就好。'
  };
}

async function resolveQWeatherLocation(location, key) {
  if (location.longitude !== undefined && location.longitude !== null && location.latitude !== undefined && location.latitude !== null) {
    return `${location.longitude},${location.latitude}`;
  }

  const city = sanitizeString(location.city, 64);
  if (!city) throw new Error('对方还没有同步城市');

  const geoHost = process.env.QWEATHER_GEO_HOST || 'geoapi.qweather.com';
  const geoUrl = `https://${geoHost}/v2/city/lookup?location=${encodeURIComponent(city)}&key=${encodeURIComponent(key)}`;
  const geo = await requestJson(geoUrl);
  if (geo.code !== '200' || !geo.location || !geo.location.length) {
    throw new Error('没有从天气服务找到这个城市');
  }
  return geo.location[0].id;
}

async function fetchQWeather(location, target = 'partner') {
  const key = process.env.QWEATHER_API_KEY || process.env.WEATHER_API_KEY || '';
  if (!key) {
    return {
      provider: 'qweather',
      configMissing: true,
      weather: serviceUnavailableWeather(location, target, 'qweather')
    };
  }

  const qLocation = await resolveQWeatherLocation(location, key);
  const apiHost = process.env.QWEATHER_API_HOST || 'devapi.qweather.com';
  const url = `https://${apiHost}/v7/weather/now?location=${encodeURIComponent(qLocation)}&key=${encodeURIComponent(key)}`;
  const data = await requestJson(url);
  if (data.code !== '200' || !data.now) {
    throw new Error(data.code ? `天气服务请求失败：${data.code}` : '天气服务请求失败');
  }

  const now = data.now;
  return {
    provider: 'qweather',
    configMissing: false,
    weather: {
      provider: 'qweather',
      city: location.city || (target === 'self' ? '我的位置' : '对方的位置'),
      temp: now.temp,
      condition: now.text,
      feelsLike: now.feelsLike,
      windDir: now.windDir,
      windScale: now.windScale,
      windSpeed: now.windSpeed,
      humidity: now.humidity,
      obsTime: now.obsTime,
      updatedText: formatTime(new Date()),
      tip: careTip(now, target)
    }
  };
}

async function fetchOpenMeteo(location, target = 'partner') {
  if (!hasCoordinates(location)) {
    throw new Error(target === 'self' ? '先同步你的位置' : '等待 Ta 同步位置');
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error(target === 'self' ? '你的位置经纬度无效，请重新选择位置' : 'Ta 的位置经纬度无效，请等待 Ta 重新同步位置');
  }

  const host = process.env.OPEN_METEO_API_HOST || 'api.open-meteo.com';
  const params = [
    `latitude=${encodeURIComponent(latitude)}`,
    `longitude=${encodeURIComponent(longitude)}`,
    'current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    'wind_speed_unit=kmh',
    'timezone=auto'
  ];
  const url = `https://${host}/v1/forecast?${params.join('&')}`;
  const data = await requestJson(url);
  const current = data.current || {};
  const code = current.weather_code;
  const now = {
    temp: current.temperature_2m,
    text: weatherCodeText(code)
  };

  return {
    provider: 'openmeteo',
    configMissing: false,
    weather: {
      provider: 'openmeteo',
      city: location.city || (target === 'self' ? '我的位置' : '对方的位置'),
      temp: current.temperature_2m ?? '--',
      condition: weatherCodeText(code),
      feelsLike: current.apparent_temperature ?? current.temperature_2m ?? '--',
      windSpeed: current.wind_speed_10m ?? '',
      windDir: '',
      windScale: '',
      humidity: current.relative_humidity_2m ?? '',
      weatherCode: code ?? '',
      obsTime: current.time || '',
      updatedText: current.time ? formatTime(current.time) : formatTime(new Date()),
      tip: careTip(now, target)
    }
  };
}

async function getUser(openid) {
  try {
    const res = await db.collection(COL_USERS).doc(openid).get();
    return res.data || null;
  } catch (e) {
    return null;
  }
}

async function getCouple(coupleId) {
  if (!coupleId) return null;
  try {
    const res = await db.collection(COL_COUPLES).doc(coupleId).get();
    return res.data ? { _id: coupleId, ...res.data } : null;
  } catch (e) {
    return null;
  }
}

async function getWeather(openid, event, target = 'partner') {
  const user = await getUser(openid);
  const coupleId = sanitizeString(event.coupleId, 128) || user?.currentCoupleId || '';
  if (!coupleId) return fail('NO_COUPLE', '请先绑定情侣关系');

  const couple = await getCouple(coupleId);
  if (!couple) return fail('COUPLE_NOT_FOUND', '情侣关系不存在');

  const members = couple.members || [];
  const me = members.find(item => item.openid === openid);
  if (!me) return fail('NO_PERMISSION', '当前用户不属于这个情侣空间');

  const normalizedTarget = target === 'self' ? 'self' : 'partner';
  const partner = members.find(item => item.openid !== openid);
  const targetOpenid = normalizedTarget === 'self' ? openid : partner?.openid;
  if (!targetOpenid) return ok({ target: normalizedTarget, hasLocation: false, message: '等待对方同步位置' });

  const locRes = await db.collection(COL_LOCATIONS)
    .where({ coupleId, openid: targetOpenid })
    .limit(1)
    .get();
  const location = locRes.data && locRes.data[0];
  if (!location) {
    return ok({
      target: normalizedTarget,
      hasLocation: false,
      targetOpenid,
      message: normalizedTarget === 'self' ? '你还没有同步自己的位置' : '等待对方同步位置'
    });
  }

  const provider = getWeatherProvider();
  if (provider === 'openmeteo' && !hasCoordinates(location)) {
    return ok({
      target: normalizedTarget,
      hasLocation: false,
      targetOpenid,
      provider,
      message: normalizedTarget === 'self' ? '先同步你的位置' : '等待 Ta 同步位置'
    });
  }

  const weatherResult = provider === 'qweather'
    ? await fetchQWeather(location, normalizedTarget)
    : await fetchOpenMeteo(location, normalizedTarget);
  const locationInfo = {
    city: location.city || '',
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    updatedText: formatTime(location.updatedAt)
  };
  return ok({
    target: normalizedTarget,
    hasLocation: true,
    coupleId,
    targetOpenid,
    provider,
    location: locationInfo,
    partnerLocation: normalizedTarget === 'partner' ? locationInfo : null,
    myLocation: normalizedTarget === 'self' ? locationInfo : null,
    ...weatherResult
  });
}

async function getPartnerWeather(openid, event) {
  return getWeather(openid, event, 'partner');
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return fail('NO_OPENID', '无法获取当前用户 openid');

  const action = sanitizeString(event.action, 32) || 'getPartnerWeather';
  try {
    if (action === 'getPartnerWeather') return getPartnerWeather(openid, event);
    if (action === 'getSelfWeather') return getWeather(openid, event, 'self');
    if (action === 'getWeather') return getWeather(openid, event, sanitizeString(event.target, 16));
    return fail('UNKNOWN_ACTION', `未知 action: ${action}`);
  } catch (e) {
    console.error('weather cloud function error:', e);
    return fail('WEATHER_FAILED', e.message || '天气获取失败');
  }
};
