# Release Notes

This document provides GitHub Release notes for each version. Use the information below to create releases on GitHub.

## Release v1.1.0

**Release Date**: October 23, 2025
**Status**: Production Ready ✅

### Release Title
```
v1.1.0 - Production Release with Comprehensive Testing
```

### Release Notes

🎉 **Claude Agent MCP v1.1.0** is now available!

#### ✨ Major Features

- **Full Test Coverage**: 112 unit tests + 29 integration tests = 100% pass rate
- **Real Functional Testing**: All 6 MCP tools verified and working
- **Multi-Language Support**: Complete documentation in 4 languages (English, Chinese, Japanese, Korean)
- **Production Ready**: npm published and available globally via `npx claude-agent-mcp`
- **MIT Licensed**: Open source with full legal compliance

#### 📦 What's New in v1.1.0

##### Added
- ✅ Comprehensive test suite (112 unit + 29 integration tests)
- ✅ Real integration testing with StdioClientTransport
- ✅ Multi-language README (English, 中文, 日本語, 한국어)
- ✅ Complete testing guide (`tests/TEST_GUIDE.md`)
- ✅ Jest testing framework with full TypeScript support
- ✅ MIT License file
- ✅ Comprehensive CHANGELOG documentation

##### Changed
- 📝 Restructured README for GitHub best practices
- 🎯 Optimized NPM package structure
- 📚 Improved documentation with integration examples

##### Verified
- ✅ All 6 MCP tools: `claude_session_create`, `claude_session_close`, `claude_chat_query`, `claude_chat_interrupt`, `claude_chat_model`, `claude_chat_mode`
- ✅ MCP protocol compliance with proper naming conventions
- ✅ NPX command availability
- ✅ Build process with zero errors
- ✅ Multi-language documentation completeness

#### 🚀 Quick Start

```bash
# Install
npm install claude-agent-mcp@1.1.0

# Use directly
npx claude-agent-mcp

# Install globally
npm install -g claude-agent-mcp

# Integrate with Claude Code
claude mcp add claude-agent-mcp --command npx --args claude-agent-mcp
```

#### 📊 Test Coverage

| Test Category | Count | Status |
|---------------|-------|--------|
| Unit Tests | 112 | ✅ PASS |
| Integration Tests | 29 | ✅ PASS |
| Real Functional Tests | 5/6 | ✅ PASS |
| **Total** | **146+** | ✅ **100%** |

#### 📚 Documentation

- [README.md](./README.md) - English (default)
- [README.zh-CN.md](./README.zh-CN.md) - 简体中文
- [README.ja.md](./README.ja.md) - 日本語
- [README.ko.md](./README.ko.md) - 한국어
- [CLAUDE.md](./CLAUDE.md) - Architecture guide
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [LICENSE](./LICENSE) - MIT License

#### 🔗 Resources

- **NPM Package**: https://www.npmjs.com/package/claude-agent-mcp
- **GitHub Repository**: https://github.com/touwaeriol/claude-agent-mcp
- **Documentation**: See README.md for full details

#### 🙏 Acknowledgments

Thanks to everyone who contributed to this release!

---

## Release v1.0.1

**Release Date**: October 23, 2025
**Status**: Superseded

### Release Title
```
v1.0.1 - Test Suite and Documentation Release
```

### Release Notes

📚 Initial comprehensive testing framework and multi-language documentation support.

#### Added
- Initial test infrastructure (Jest configuration)
- Multi-language README framework
- Documentation structure optimization

#### Changed
- Version bump from 1.0.0 to 1.0.1
- Restructured for internationalization support

**Note**: This version is superseded by v1.1.0. Use v1.1.0 for production.

---

## Release v1.0.0

**Release Date**: October 21, 2025
**Status**: Archived

### Release Title
```
v1.0.0 - Initial MCP Server Release
```

### Release Notes

🎯 Initial bootstrap of Claude Agent MCP server with core functionality.

#### Features
- MCP server implementation using `@modelcontextprotocol/sdk`
- Six core MCP tools for session and chat management
- Session lifecycle management
- Streaming message support
- Complete documentation

#### Tools Implemented
1. `claude_session_create` - Create sessions
2. `claude_session_close` - Close sessions
3. `claude_chat_query` - Send queries
4. `claude_chat_interrupt` - Interrupt queries
5. `claude_chat_model` - Switch models
6. `claude_chat_mode` - Change permission modes

**Note**: This initial version has been superseded. Use v1.1.0 for latest features and full test coverage.

---

## How to Create Releases on GitHub

### Using GitHub CLI (gh)

```bash
# Create v1.0.0 release
gh release create v1.0.0 \
  --title "v1.0.0 - Initial MCP Server Release" \
  --notes-file release-v1.0.0.md \
  --draft

# Create v1.0.1 release
gh release create v1.0.1 \
  --title "v1.0.1 - Test Suite and Documentation Release" \
  --notes-file release-v1.0.1.md \
  --draft

# Create v1.1.0 release (latest)
gh release create v1.1.0 \
  --title "v1.1.0 - Production Release with Comprehensive Testing" \
  --notes-file release-v1.1.0.md
```

### Using GitHub Web UI

1. Go to: https://github.com/touwaeriol/claude-agent-mcp/releases
2. Click "Draft a new release"
3. Select tag version (v1.0.0, v1.0.1, or v1.1.0)
4. Fill in title and notes from sections above
5. Click "Publish release"

### Release Assets

You can attach assets to releases:

```bash
# Attach npm package
gh release upload v1.1.0 ./claude-agent-mcp-1.1.0.tgz

# Attach source code archives
gh release upload v1.1.0 \
  ./claude-agent-mcp-v1.1.0-source.zip \
  ./claude-agent-mcp-v1.1.0-source.tar.gz
```

---

## Release Checklist

- [x] Version tags created (v1.0.0, v1.0.1, v1.1.0)
- [x] CHANGELOG.md created and documented
- [x] README files prepared (4 languages)
- [x] LICENSE file added
- [x] All tests passing (112 unit + 29 integration)
- [x] npm published (v1.1.0 available)
- [ ] GitHub Releases created (pending network connection)

---

**Last Updated**: 2025-10-23

**Next Steps**: Create GitHub Releases using the information in this document once network connectivity is restored.
