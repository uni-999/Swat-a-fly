local nk = require("nakama")

local TRACK_IDS = {
  "canyon_loop",
  "switchback_run",
  "twin_fang",
  "dune_orbit",
  "neon_delta",
  "volcano_spiral",
  "glacier_chicane"
}

local function ensure_leaderboards()
  for _, track_id in ipairs(TRACK_IDS) do
    local leaderboard_id = "track_" .. track_id .. "_time"
    local ok, err = pcall(function()
      nk.leaderboard_create(
        leaderboard_id,
        true,
        "asc",
        "best",
        "",
        { track_id = track_id, metric = "time_ms" },
        true
      )
    end)

    if not ok then
      nk.logger_warn("leaderboard create skipped for " .. leaderboard_id .. ": " .. tostring(err))
    else
      nk.logger_info("leaderboard ready: " .. leaderboard_id)
    end
  end
end

local function rpc_submit_race_time(_context, payload)
  local data = nk.json_decode(payload or "{}")
  if type(data) == "string" then
    data = nk.json_decode(data)
  end
  if type(data) ~= "table" then
    error("invalid payload")
  end
  local owner_id = data.owner_id or data.user_id
  local user_id = data.user_id or owner_id
  local username = data.username or data.player_name or user_id
  local track_id = data.track_id
  local score = tonumber(data.score)
  local leaderboard_id = data.leaderboard_id
  local metadata = data.metadata or {}

  if owner_id == nil or tostring(owner_id) == "" then
    error("owner_id is required")
  end

  if score == nil then
    error("score is required")
  end

  if leaderboard_id == nil or tostring(leaderboard_id) == "" then
    if track_id == nil or tostring(track_id) == "" then
      error("track_id or leaderboard_id is required")
    end
    leaderboard_id = "track_" .. tostring(track_id) .. "_time"
  end

  nk.leaderboard_record_write(
    tostring(leaderboard_id),
    tostring(owner_id),
    tostring(username),
    math.floor(score),
    tonumber(data.subscore) or 0,
    metadata
  )

  return nk.json_encode({
    ok = true,
    leaderboard_id = tostring(leaderboard_id),
    owner_id = tostring(owner_id),
    user_id = tostring(user_id),
    username = tostring(username),
    score = math.floor(score)
  })
end

nk.register_rpc(rpc_submit_race_time, "submit_race_time")

local ok, err = pcall(ensure_leaderboards)
if not ok then
  nk.logger_warn("Leaderboard bootstrap failed: " .. tostring(err))
end

nk.logger_info("Nakama runtime module loaded: submit_race_time RPC registered.")
