use proptest::prelude::*;
use tridjaya_backend::campaign_config::{
    CampaignConfigSchema, DelayConfig, MediaConfig, MediaTypeEnum,
};

fn media_type_strategy() -> impl Strategy<Value = MediaTypeEnum> {
    prop_oneof![
        Just(MediaTypeEnum::Image),
        Just(MediaTypeEnum::Pdf),
        Just(MediaTypeEnum::Video),
        Just(MediaTypeEnum::None),
    ]
}

fn media_config_strategy() -> impl Strategy<Value = Option<MediaConfig>> {
    prop_oneof![
        Just(None),
        (
            media_type_strategy(),
            prop_oneof![
                Just(None),
                Just(Some("https://example.com/media.jpg".to_string())),
                Just(Some("https://example.com/file.pdf".to_string())),
                Just(Some("https://example.com/video.mp4".to_string())),
            ],
        )
            .prop_map(|(media_type, media_url)| Some(MediaConfig { media_type, media_url })),
    ]
}

fn message_template_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        // Simple non-spintax messages
        "[A-Za-z0-9 ,.!?]{1,80}".prop_map(|s| s.trim().to_string()).prop_filter(
            "message must not be empty after trim",
            |s| !s.is_empty(),
        ),
        // Valid spintax-ready messages
        Just("{Halo|Hi|Hello} {{name}}".to_string()),
        Just("{Promo|Diskon} {hari ini|minggu ini}".to_string()),
    ]
}

proptest! {
    /// Property 2: Parse -> Pretty Print -> Parse produces equivalent object.
    /// Validates requirements 16.4 (with parser/pretty-printer behavior from 16.1-16.3,16.8).
    #[test]
    fn property_campaign_config_round_trip_consistent(
        message_template in message_template_strategy(),
        min_delay in 5000u64..=30000u64,
        max_delay in 5000u64..=30000u64,
        spintax_enabled in any::<bool>(),
        media_config in media_config_strategy(),
    ) {
        let (min_delay_ms, max_delay_ms) = if min_delay <= max_delay {
            (min_delay, max_delay)
        } else {
            (max_delay, min_delay)
        };

        let template = if spintax_enabled {
            // Ensure syntax is valid when spintax is enabled.
            "{Halo|Hi|Hello} {{name}}".to_string()
        } else {
            message_template
        };

        let original = CampaignConfigSchema {
            message_template: template,
            delay_config: DelayConfig {
                min_delay_ms,
                max_delay_ms,
            },
            spintax_enabled,
            media_config,
        };

        let pretty = original.to_pretty_json();
        let reparsed = CampaignConfigSchema::parse(&pretty)
            .expect("parse after pretty print must succeed");

        prop_assert_eq!(original, reparsed);
    }
}
