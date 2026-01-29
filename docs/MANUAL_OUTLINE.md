# AWCP v1 Manual Outline

This document tracks what content should be included in the official AWCP manual once v1 is complete.

**Status**: Planning phase - content TBD after v1 implementation stabilizes.

---

## 1. Overview

- [ ] What is AWCP
- [ ] Use cases and scenarios
- [ ] Architecture diagram (Delegator ↔ Executor)
- [ ] Relationship with A2A protocol

## 2. Quick Start

- [ ] Installation
- [ ] Minimal Delegator setup
- [ ] Minimal Executor setup
- [ ] Running first delegation

## 3. Core Concepts

- [ ] Delegation lifecycle (INVITE → ACCEPT → START → DONE)
- [ ] Delegator vs Executor roles
- [ ] Workspace and mount points
- [ ] Access modes (ro/rw)
- [ ] TTL and lease management

## 4. Delegator Guide

- [ ] DelegatorService API
- [ ] DelegatorDaemon (standalone mode)
- [ ] DelegatorDaemonClient (for MCP/CLI integration)
- [ ] Configuration reference (DelegatorConfig)
- [ ] Export view strategies (symlink, bind, worktree)
- [ ] SSH credential management

## 5. Executor Guide

- [ ] ExecutorService API
- [ ] Integrating with A2A agent
- [ ] Configuration reference (ExecutorConfig)
- [ ] Mount point management
- [ ] Sandbox profiles

## 6. Hooks Reference

### Lifecycle Diagram

```
Delegator                                 Executor
     │                                         │
     │  创建委托                                │
     ▼                                         │
┌─────────────┐                                │
│ onDelegation│                                │
│ Created     │                                │
└─────────────┘                                │
     │                                         │
     │────── INVITE ──────────────────────────►│
     │                                         ▼
     │                                   ┌───────────┐
     │                                   │ onInvite  │ ← 可返回 false 拒绝
     │                                   └───────────┘
     │                                         │
     │◄───── ACCEPT ──────────────────────────│
     │                                         │
     │────── START ───────────────────────────►│
     │                                         │
     │                                    [SSHFS 挂载]
     │                                         │
     ▼                                         ▼
┌─────────────┐                          ┌───────────┐
│ onDelegation│                          │onTaskStart│ ← mountPoint 可用
│ Started     │                          └───────────┘
└─────────────┘                                │
     │                                    [执行任务]
     │                                         │
     │                                    [SSHFS 卸载]
     │                                         │
     │◄───── DONE ────────────────────────────│
     │                                         ▼
     ▼                                   ┌────────────┐
┌─────────────┐                          │onTaskComplete│
│ onDelegation│                          └────────────┘
│ Completed   │
└─────────────┘


        ─── 如果出错 ───

     │◄───── ERROR ───────────────────────────│
     ▼                                         ▼
┌─────────────┐                          ┌───────────┐
│ onError     │                          │ onError   │
└─────────────┘                          └───────────┘
```

### Executor Hooks

- [ ] `onInvite(invite: InviteMessage) → Promise<boolean>` - 审批委托请求
- [ ] `onTaskStart(delegationId, mountPoint)` - 挂载完成，任务开始
- [ ] `onTaskComplete(delegationId, summary)` - 任务成功完成
- [ ] `onError(delegationId, error)` - 错误处理

### Delegator Hooks

- [ ] `onDelegationCreated(delegation)` - 委托创建完成
- [ ] `onDelegationStarted(delegation)` - Executor 开始执行
- [ ] `onDelegationCompleted(delegation)` - 委托成功完成
- [ ] `onError(delegationId, error)` - 错误处理

## 7. Express Integration

- [ ] `executorHandler()` middleware
- [ ] `delegatorHandler()` middleware (if applicable)
- [ ] Example: Adding AWCP to existing A2A agent

## 8. Transport Layer

- [ ] SSHFS transport overview
- [ ] SshfsMountClient API
- [ ] SshfsExportManager API
- [ ] Prerequisites (macFUSE, sshfs installation)
- [ ] Troubleshooting mount issues

## 9. Error Handling

- [ ] Error codes reference
- [ ] AwcpError class
- [ ] Common error scenarios and solutions

## 10. Security Considerations

- [ ] Credential lifecycle
- [ ] Sandbox enforcement
- [ ] Access mode implications
- [ ] Network security recommendations

## 11. Examples

- [ ] Basic local delegation (01-local-basic)
- [ ] Remote SSH delegation
- [ ] Multi-agent collaboration
- [ ] MCP integration example

## 12. API Reference

- [ ] @awcp/core types
- [ ] @awcp/sdk exports
- [ ] @awcp/transport-sshfs exports

---

## Notes

记录一些实现过程中的设计决策和注意事项，便于后续写文档时参考：

### 2024-01-29

- Executor Agent 设计：A2A + AWCP 共享同一个 executor 实例，通过 hooks 桥接
- workingDirectory 由 AWCP 的 onTaskStart hook 设置，确保 executor 知道操作哪个目录
- 安全设计：用户只能指定相对路径，完整路径由系统通过 join(workingDirectory, filename) 构建
