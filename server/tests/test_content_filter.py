"""内容过滤 — 纯函数测试"""

from server.services.content_filter import filter_message


def test_phone_blocked():
    result = filter_message("加我微信 wxid123")
    assert result["blocked"] is True

def test_phone_blocked_explicit():
    result = filter_message("我的手机 13812345678")
    assert result["blocked"] is True

def test_url_blocked():
    result = filter_message("看这个 http://spam.com")
    assert result["blocked"] is True

def test_email_blocked():
    result = filter_message("发我邮箱 test@spam.com")
    assert result["blocked"] is True

def test_normal_pass():
    result = filter_message("今天好累啊")
    assert result["blocked"] is False

def test_normal_number_pass():
    """不误伤正常数字 — '工作12小时' 不应被拦截"""
    result = filter_message("我每天工作12小时")
    assert result["blocked"] is False
