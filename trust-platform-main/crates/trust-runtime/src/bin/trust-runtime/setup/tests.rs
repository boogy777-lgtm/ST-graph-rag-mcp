    use super::*;

    #[test]
    fn browser_profile_local_enforces_loopback_and_no_token() {
        let profile =
            BrowserSetupProfile::build(SetupAccessArg::Local, None, DEFAULT_SETUP_PORT, None)
                .expect("local profile");
        assert_eq!(profile.bind, "127.0.0.1");
        assert!(!profile.token_required);
        assert_eq!(profile.token_ttl_minutes, 0);

        let err = BrowserSetupProfile::build(
            SetupAccessArg::Local,
            Some("0.0.0.0".to_string()),
            DEFAULT_SETUP_PORT,
            None,
        )
        .expect_err("local non-loopback must fail");
        assert!(err.to_string().contains("loopback"));
    }

    #[test]
    fn browser_profile_remote_requires_non_loopback_and_token_ttl() {
        let profile =
            BrowserSetupProfile::build(SetupAccessArg::Remote, None, DEFAULT_SETUP_PORT, None)
                .expect("remote profile");
        assert_eq!(profile.bind, "0.0.0.0");
        assert!(profile.token_required);
        assert_eq!(profile.token_ttl_minutes, DEFAULT_REMOTE_TOKEN_TTL_MINUTES);

        let loopback_err = BrowserSetupProfile::build(
            SetupAccessArg::Remote,
            Some("127.0.0.1".to_string()),
            DEFAULT_SETUP_PORT,
            Some(15),
        )
        .expect_err("remote loopback must fail");
        assert!(loopback_err
            .to_string()
            .contains("must not use a loopback bind"));

        let ttl_err =
            BrowserSetupProfile::build(SetupAccessArg::Remote, None, DEFAULT_SETUP_PORT, Some(0))
                .expect_err("remote ttl zero must fail");
        assert!(ttl_err.to_string().contains("token_ttl_minutes > 0"));
    }
