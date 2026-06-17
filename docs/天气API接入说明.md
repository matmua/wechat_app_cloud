# 天气 API 接入说明

## 1. 当前接入状态

`天气卡片` 页面通过 `cloudfunctions/weather` 云函数读取天气，支持同时查看“我的天气”和“Ta 的天气”。前端只调用云函数，不直接请求第三方天气 API，也不会保存任何 API key。

默认天气服务是：

```text
WEATHER_PROVIDER=openmeteo
```

如果不配置 `WEATHER_PROVIDER`，云函数也会默认使用 Open-Meteo。

## 2. 默认方案：Open-Meteo

Open-Meteo 非商业使用不需要 API key，适合当前两个人自用和测试。

云函数请求接口：

```text
https://api.open-meteo.com/v1/forecast
```

请求参数核心结构：

```text
latitude=纬度
longitude=经度
current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m
wind_speed_unit=kmh
timezone=auto
```

返回后云函数会整理成前端统一字段：

| 字段 | 来源 |
| -- | -- |
| `temp` | `current.temperature_2m` |
| `humidity` | `current.relative_humidity_2m` |
| `feelsLike` | `current.apparent_temperature` |
| `weatherCode` | `current.weather_code` |
| `windSpeed` | `current.wind_speed_10m` |
| `updatedText` | `current.time` |
| `condition` | 云函数把 `weather_code` 映射为中文 |

注意：Open-Meteo 依赖经纬度。天气页里建议先点击“用当前位置”同步经纬度；“地图选点”保留为备选。如果只手动填写城市但没有经纬度，默认 Open-Meteo 无法查询，会提示先同步位置。

官方文档：

- Open-Meteo Forecast API：https://open-meteo.com/en/docs
- Open-Meteo WMO weather_code：https://open-meteo.com/en/docs/dwd-api

## 3. weather_code 中文映射

当前云函数内置简化映射：

| weather_code | 中文 |
| -- | -- |
| `0` | 晴 |
| `1, 2` | 多云 |
| `3` | 阴 |
| `45, 48` | 雾 |
| `51, 53, 55, 56, 57, 61, 80` | 小雨 |
| `63, 66, 67, 81` | 中雨 |
| `65, 82` | 大雨 |
| `71, 73, 75, 77, 85, 86` | 雪 |
| `95, 96, 99` | 雷雨 |

后续如果想更细，可以把冻雨、阵雨、雨夹雪等拆成更具体的中文文案。

## 4. 可选方案：QWeather

如果以后想切到和风天气，在云函数环境变量里配置：

```text
WEATHER_PROVIDER=qweather
QWEATHER_API_KEY=你的和风天气 key
```

可选环境变量：

| 环境变量 | 说明 |
| -- | -- |
| `QWEATHER_API_HOST` | 默认 `devapi.qweather.com` |
| `QWEATHER_GEO_HOST` | 默认 `geoapi.qweather.com` |
| `WEATHER_API_KEY` | 兼容备用 key 名，未设置 `QWEATHER_API_KEY` 时读取 |

QWeather 模式支持经纬度，也支持只有城市名时先走 GeoAPI 查询城市 ID。没有配置 key 时，云函数不会崩溃，会返回“天气服务暂未配置”。

QWeather 参考文档：

- 实时天气：https://dev.qweather.com/en/docs/api/weather/weather-now/
- 城市搜索：https://dev.qweather.com/en/docs/api/geoapi/city-lookup/
- 凭据说明：https://dev.qweather.com/en/docs/configuration/project-and-key/

## 5. 为什么 API 请求仍然放在云函数里

1. 前端不暴露将来可能使用的 QWeather API key。
2. 云函数可以统一检查 `openid`、`coupleId` 和绑定关系，避免读取到不属于当前情侣空间的位置。
3. 第三方 API 返回字段不同，云函数可以统一整理成前端固定字段。
4. 后续可以在云函数里加缓存、限流、降级提示，不需要改页面。

## 6. 数据库集合

天气位置仍使用 `partner_locations`：

| 字段 | 说明 |
| -- | -- |
| `openid` | 主动同步位置的用户 |
| `coupleId` | 当前情侣关系 ID |
| `city` | 位置名称或城市名 |
| `latitude` | 纬度，Open-Meteo 必需 |
| `longitude` | 经度，Open-Meteo 必需 |
| `updatedAt` | 同步时间 |

“我的天气”读取当前用户在当前 `coupleId` 下的位置；“Ta 的天气”读取同一个 `coupleId` 下另一位用户的位置。

## 7. 上传和配置

需要上传并部署：

- `cloudfunctions/weather`

默认 Open-Meteo 不需要配置任何 API key，也不需要设置环境变量。

如果要显式指定默认 provider，可以配置：

```text
WEATHER_PROVIDER=openmeteo
```

如果切到 QWeather，再配置：

```text
WEATHER_PROVIDER=qweather
QWEATHER_API_KEY=你的和风天气 key
```

## 8. 测试流程

1. 完成情侣绑定。
2. A 进入 `天气卡片` 页面，点击“用当前位置”，成功获取经纬度后点“同步我的天气位置”。
3. A 刷新页面，应看到“我的天气”卡片；如果 B 还没同步，应看到“等待 Ta 同步位置”。
4. B 用另一个账号进入同一页面，重复选择位置和同步。
5. A 再刷新，应同时看到“我的天气”和“Ta 的天气”。
6. B 再刷新，也应同时看到两张天气卡。

失败时请提供：

1. 微信开发者工具控制台报错截图。
2. `weather` 云函数日志。
3. `partner_locations` 中两个人的记录，重点看 `coupleId`、`openid`、`latitude`、`longitude` 是否存在。
4. 如果使用 QWeather，提供环境变量是否已配置的截图，注意遮挡 key。

如果“地图选点”页面在微信开发者工具里白屏，可以先不用它；当前版本已经提供“用当前位置”按钮，不需要打开地图也能保存 Open-Meteo 需要的经纬度。

如果页面显示“我已同步”但仍看不到自己的天气，请检查页面下方是否显示“已保存经纬度”。只有城市名、没有 `latitude/longitude` 时，Open-Meteo 不能查询天气，需要重新点“用当前位置”或直接点“同步我的天气位置”补齐经纬度。
