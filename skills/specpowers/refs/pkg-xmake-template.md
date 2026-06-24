# pkg-xmake 编写模板

用于 `scripts/pkg-xmake/{name}.lua` 的新增/修改。四段式结构：

## 完整模板

```lua
-- ===== Part 0: 全局注册表初始化 =====
_PKG_FETCH = _PKG_FETCH or {}

-- ===== Part 1: 核心导出函数（query-pkg.lua 调用入口） =====
-- dir: thirdparty/{name}/{version}/ 绝对路径
-- 返回: {links, bindirs, linkdirs, includedirs}
function _PKG_FETCH.<name>(dir)
    local result = {}
    local inc = path.join(dir, "include")
    if os.isdir(inc) then result.includedirs = {inc} end

    if is_plat("windows") then
        local mode = is_mode("debug") and "debug" or "release"
        local suffix = is_mode("debug") and "d" or ""
        result.bindirs = {path.join(dir, "bin", "win64_<toolset>_" .. mode)}
        result.linkdirs = {path.join(dir, "lib", "win64_<toolset>_" .. mode)}
        result.links = {"<name>" .. suffix}
    elseif is_plat("linux") then
        local bdir = path.join(dir, "lib")
        if os.isdir(bdir) then
            result.bindirs = {bdir}
            result.linkdirs = {bdir}
        end
        result.links = {"<name>"}
    end

    return result
end

-- ===== Part 2: on_load 辅助 =====
function _on_load_<name>(package)
    local dir = package:config("dir")
    if not dir then
        dir = path.absolute(path.join(os.scriptdir(), "..", "..",
            "thirdparty", "<name>"))
    end
    if dir and os.isdir(dir) then
        local subdirs = os.dirs(path.join(dir, "*"))
        if #subdirs > 0 then dir = subdirs[1] end
        package:set("dir", dir)
    end
end

-- ===== Part 3: package 定义 =====
package("<name>")
    set_description("<name> - <one-line description>")
    on_load(_on_load_<name>)
    on_fetch(function (package, opt)
        return _PKG_FETCH.<name>(package:get("dir"))
    end)
```

## 四种类型

| 类型 | 特征 | 与完整模板的差异 |
|------|------|-----------------|
| 标准链接库 | links + bindirs + linkdirs + includedirs | 完整模板 |
| 纯运行时 | links=[], only bindirs | 无 _on_load；Part 1 无 links/linkdirs/includedirs |
| CBB 模块 | include 路径: `publish/backend/` | Part 1 inc = `path.join(dir, "publish", "backend", "include")` |
| 平台模块 | 大量 links + `commonheaders` include | Part 1 inc = `path.join(dir, "commonheaders")`；links 列表 ~21 项 |

## 硬编码说明

- `win64_v141_`, `win64_vc15_` 等工具集标签：描述依赖包实际目录结构（依赖用何种工具集编译）
- link 名 (`zyxlib`, `isva_RP2_0`, `liblz4` 等)：依赖提供的实际文件名
- `publish/backend/`：CBB 模块内部目录约定

## safenet 特殊处理

文件名 `safenet.lua` 但 package 名 `SafeNet`。文件末尾加别名：

```lua
_PKG_FETCH["safenet"] = _PKG_FETCH.SafeNet
```
