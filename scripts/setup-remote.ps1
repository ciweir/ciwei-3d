#!/usr/bin/env pwsh
<#
设置 git 远端 + 首推
用法：node scripts/setup-remote.mjs <仓库URL>
示例：node scripts/setup-remote.mjs https://github.com/你的用户名/ciwei-world.git
（或直接：git remote add origin <URL> && git push -u origin main）
此脚本会：
  1. 检查远端是否已存在（避免重复添加）
  2. 添加远端（如不存在）
  3. 推送 main 分支（设置 upstream）
本机当前无 git 凭证（credential.helper 空），执行推送时会提示你输入 GitHub 用户名/Token。
#>
param(
  [Parameter(Mandatory = $true)][string]$RepoUrl
)

Set-Location -Path $PSScriptRoot\..
Write-Output "仓库: $RepoUrl"

$existing = git remote get-url origin 2>&1
if ($LASTEXITCODE -eq 0 -and $existing) {
  Write-Output "origin 已存在: $existing"
  Write-Output "如需更换：git remote set-url origin $RepoUrl"
} else {
  git remote add origin $RepoUrl
  Write-Output "origin 已添加"
}

Write-Output "推送 main..."
git push -u origin main 2>&1 | Select-Object -First 3

Write-Output "当前状态:"
git remote -v | Select-Object -First 1
git log --oneline -1
