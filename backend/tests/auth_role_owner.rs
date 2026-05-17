use proptest::prelude::*;
use std::str::FromStr;
use tridjaya_backend::auth::Role;

/// Strategy that generates any valid Role variant.
fn role_strategy() -> impl Strategy<Value = Role> {
    prop_oneof![
        Just(Role::Admin),
        Just(Role::Agent),
        Just(Role::Sales),
        Just(Role::Operator),
        Just(Role::Owner),
        Just(Role::PicRaport),
    ]
}

/// Strategy that generates random case variations of the string "owner".
/// Each character is independently uppercased or lowercased.
fn owner_case_variation_strategy() -> impl Strategy<Value = String> {
    [any::<bool>(); 5].prop_map(|cases| {
        let chars = ['o', 'w', 'n', 'e', 'r'];
        chars
            .iter()
            .zip(cases.iter())
            .map(|(c, upper)| {
                if *upper {
                    c.to_uppercase().to_string()
                } else {
                    c.to_lowercase().to_string()
                }
            })
            .collect::<String>()
    })
}

proptest! {
    /// Property 1: Role Serialization Round-Trip
    /// For any Role variant, serializing to string and parsing back produces the original variant.
    ///
    /// **Validates: Requirements 1.1, 1.2**
    #[test]
    fn property_role_serialization_round_trip(role in role_strategy()) {
        let serialized = role.to_string();
        let parsed = Role::from_str(&serialized)
            .expect("parsing a serialized Role should always succeed");
        prop_assert_eq!(role, parsed);
    }

    /// Property 1 (continued): Any case variation of "owner" parses to Role::Owner.
    ///
    /// **Validates: Requirements 1.1, 1.2**
    #[test]
    fn property_owner_case_insensitive_parsing(input in owner_case_variation_strategy()) {
        let parsed = Role::from_str(&input)
            .expect("any case variation of 'owner' should parse successfully");
        prop_assert_eq!(Role::Owner, parsed);
    }
}
