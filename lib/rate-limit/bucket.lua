local cost = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local available = {}
for i = 1, #KEYS do
  local points = tonumber(ARGV[1 + 2 * i])
  local window = tonumber(ARGV[2 + 2 * i])
  local stored = redis.call('HMGET', KEYS[i], 'tokens', 'ts')
  local tokens = tonumber(stored[1])
  local ts = tonumber(stored[2])
  if tokens == nil or ts == nil then
    tokens = points
    ts = now
  end
  local rate = points / window
  tokens = math.min(points, tokens + math.max(0, now - ts) / 1000 * rate)
  if tokens < cost then
    return {0, math.ceil((cost - tokens) / rate), math.floor(tokens), i - 1}
  end
  available[i] = tokens
end
local remaining = nil
for i = 1, #KEYS do
  local window = tonumber(ARGV[2 + 2 * i])
  local left = available[i] - cost
  redis.call('HSET', KEYS[i], 'tokens', left, 'ts', now)
  redis.call('PEXPIRE', KEYS[i], window * 1000)
  local whole = math.floor(left)
  if remaining == nil or whole < remaining then
    remaining = whole
  end
end
return {1, 0, remaining, -1}
