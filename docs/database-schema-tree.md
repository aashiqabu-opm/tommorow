# OPM Database Schema Tree

Generated from Prisma Schema.

<details>
<summary>Table of Contents</summary>

- [audit_log_entries](#audit_log_entries)
- [custom_oauth_providers](#custom_oauth_providers)
- [flow_state](#flow_state)
- [identities](#identities)
- [instances](#instances)
- [mfa_amr_claims](#mfa_amr_claims)
- [mfa_challenges](#mfa_challenges)
- [mfa_factors](#mfa_factors)
- [oauth_authorizations](#oauth_authorizations)
- [oauth_client_states](#oauth_client_states)
- [oauth_clients](#oauth_clients)
- [oauth_consents](#oauth_consents)
- [one_time_tokens](#one_time_tokens)
- [refresh_tokens](#refresh_tokens)
- [saml_providers](#saml_providers)
- [saml_relay_states](#saml_relay_states)
- [schema_migrations](#schema_migrations)
- [sessions](#sessions)
- [sso_domains](#sso_domains)
- [sso_providers](#sso_providers)
- [users](#users)
- [webauthn_challenges](#webauthn_challenges)
- [webauthn_credentials](#webauthn_credentials)
- [RevenueCutoverAudit](#revenuecutoveraudit)
- [TalentSubmission](#talentsubmission)
- [account_transactions](#account_transactions)
- [ai_usage](#ai_usage)
- [app_settings](#app_settings)
- [artist_payout_ledger](#artist_payout_ledger)
- [artists](#artists)
- [audit_logs](#audit_logs)
- [bank_accounts](#bank_accounts)
- [bank_transactions](#bank_transactions)
- [box_office_collections](#box_office_collections)
- [budget_lines](#budget_lines)
- [call_sheets](#call_sheets)
- [campaign_assets](#campaign_assets)
- [cash_entries](#cash_entries)
- [comments](#comments)
- [contracts](#contracts)
- [conversation_members](#conversation_members)
- [conversations](#conversations)
- [crew_payments](#crew_payments)
- [day_checklist](#day_checklist)
- [day_requirements](#day_requirements)
- [document_files](#document_files)
- [documents](#documents)
- [error_logs](#error_logs)
- [financial_reports](#financial_reports)
- [funding_transactions](#funding_transactions)
- [gst_inputs](#gst_inputs)
- [industry_films](#industry_films)
- [ledgers](#ledgers)
- [liabilities](#liabilities)
- [liability_payments](#liability_payments)
- [locations](#locations)
- [messages](#messages)
- [monitoring_findings](#monitoring_findings)
- [notifications](#notifications)
- [opm_records_channels](#opm_records_channels)
- [opm_records_royalties](#opm_records_royalties)
- [opm_records_titles](#opm_records_titles)
- [opm_records_videos](#opm_records_videos)
- [payment_requests](#payment_requests)
- [personal_accounts](#personal_accounts)
- [personal_capital_gains](#personal_capital_gains)
- [personal_cards](#personal_cards)
- [personal_company_ledger](#personal_company_ledger)
- [personal_deductions](#personal_deductions)
- [personal_delegates](#personal_delegates)
- [personal_documents](#personal_documents)
- [personal_film_stakes](#personal_film_stakes)
- [personal_guarantees](#personal_guarantees)
- [personal_health_policies](#personal_health_policies)
- [personal_legal_cases](#personal_legal_cases)
- [personal_recurring](#personal_recurring)
- [personal_royalties](#personal_royalties)
- [personal_synced_emails](#personal_synced_emails)
- [personal_tax_items](#personal_tax_items)
- [personal_tax_profile](#personal_tax_profile)
- [personal_transactions](#personal_transactions)
- [personal_vehicles](#personal_vehicles)
- [petty_cash_floats](#petty_cash_floats)
- [petty_cash_txns](#petty_cash_txns)
- [phase_tasks](#phase_tasks)
- [production_reports](#production_reports)
- [profiles](#profiles)
- [project_archival](#project_archival)
- [project_auditions](#project_auditions)
- [project_channels](#project_channels)
- [project_characters](#project_characters)
- [project_checkins](#project_checkins)
- [project_crew](#project_crew)
- [project_deal_memos](#project_deal_memos)
- [project_deals](#project_deals)
- [project_deliverables](#project_deliverables)
- [project_documents](#project_documents)
- [project_funding](#project_funding)
- [project_income](#project_income)
- [project_members](#project_members)
- [project_messages](#project_messages)
- [project_post_tasks](#project_post_tasks)
- [project_press_kit](#project_press_kit)
- [project_schedule](#project_schedule)
- [project_tasks](#project_tasks)
- [projects](#projects)
- [raw_earning_line_items](#raw_earning_line_items)
- [releases](#releases)
- [royalty_splits](#royalty_splits)
- [scene_elements](#scene_elements)
- [scenes](#scenes)
- [schedule_day_scenes](#schedule_day_scenes)
- [scheduled_tasks](#scheduled_tasks)
- [staff_salaries](#staff_salaries)
- [system_status](#system_status)
- [takeover_compliance](#takeover_compliance)
- [tds_challans](#tds_challans)
- [templates](#templates)
- [thread_summaries](#thread_summaries)
- [tracks](#tracks)
- [vehicle_documents](#vehicle_documents)
- [vehicle_logs](#vehicle_logs)
- [vehicles](#vehicles)
- [vendors](#vendors)
- [voucher_entries](#voucher_entries)
- [vouchers](#vouchers)
- [wa_rate_limit](#wa_rate_limit)
- [MusicTitles](#musictitles)
- [RevenueSync](#revenuesync)
- [OfficeLedger](#officeledger)
- [StaffClearance](#staffclearance)
- [Pipelines](#pipelines)
- [BelieveCatalogTakeover](#believecatalogtakeover)
- [TrackMetadata](#trackmetadata)

</details>

---

## audit_log_entries

| Field | Type | Attributes / Relations |
|---|---|---|
| `instance_id` | `String?` | @db.Uuid |
| `id` | `String` | @id @db.Uuid |
| `payload` | `Json?` | @db.Json |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `ip_address` | `String` | @default("") @db.VarChar(64) |

## custom_oauth_providers

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `provider_type` | `String` | - |
| `identifier` | `String` | @unique |
| `name` | `String` | - |
| `client_id` | `String` | - |
| `client_secret` | `String` | - |
| `acceptable_client_ids` | `String[]` | @default([]) |
| `scopes` | `String[]` | @default([]) |
| `pkce_enabled` | `Boolean` | @default(true) |
| `attribute_mapping` | `Json` | @default("{ |

## flow_state

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `user_id` | `String?` | @db.Uuid |
| `auth_code` | `String?` | - |
| `code_challenge_method` | `code_challenge_method?` | - |
| `code_challenge` | `String?` | - |
| `provider_type` | `String` | - |
| `provider_access_token` | `String?` | - |
| `provider_refresh_token` | `String?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `authentication_method` | `String` | - |
| `auth_code_issued_at` | `DateTime?` | @db.Timestamptz(6) |
| `invite_token` | `String?` | - |
| `referrer` | `String?` | - |
| `oauth_client_state_id` | `String?` | @db.Uuid |
| `linking_target_id` | `String?` | @db.Uuid |
| `email_optional` | `Boolean` | @default(false) |
| `saml_relay_states` | `saml_relay_states[]` | - |

## identities

| Field | Type | Attributes / Relations |
|---|---|---|
| `provider_id` | `String` | - |
| `user_id` | `String` | @db.Uuid |
| `identity_data` | `Json` | - |
| `provider` | `String` | - |
| `last_sign_in_at` | `DateTime?` | @db.Timestamptz(6) |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `email` | `String?` | @default(dbgenerated("lower((identity_data ->> 'email'::text))")) |
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## instances

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `uuid` | `String?` | @db.Uuid |
| `raw_base_config` | `String?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |

## mfa_amr_claims

| Field | Type | Attributes / Relations |
|---|---|---|
| `session_id` | `String` | @db.Uuid |
| `created_at` | `DateTime` | @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @db.Timestamptz(6) |
| `authentication_method` | `String` | - |
| `id` | `String` | @id(map: "amr_id_pk") @db.Uuid |
| `sessions` | `sessions` | @relation(fields: [session_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## mfa_challenges

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `factor_id` | `String` | @db.Uuid |
| `created_at` | `DateTime` | @db.Timestamptz(6) |
| `verified_at` | `DateTime?` | @db.Timestamptz(6) |
| `ip_address` | `String` | @db.Inet |
| `otp_code` | `String?` | - |
| `web_authn_session_data` | `Json?` | - |
| `mfa_factors` | `mfa_factors` | @relation(fields: [factor_id], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "mfa_challenges_auth_factor_id_fkey") |

## mfa_factors

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `friendly_name` | `String?` | - |
| `factor_type` | `factor_type` | - |
| `status` | `factor_status` | - |
| `created_at` | `DateTime` | @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @db.Timestamptz(6) |
| `secret` | `String?` | - |
| `phone` | `String?` | - |
| `last_challenged_at` | `DateTime?` | @unique @db.Timestamptz(6) |
| `web_authn_credential` | `Json?` | - |
| `web_authn_aaguid` | `String?` | @db.Uuid |
| `last_webauthn_challenge_data` | `Json?` | - |
| `mfa_challenges` | `mfa_challenges[]` | - |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## oauth_authorizations

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `authorization_id` | `String` | @unique |
| `client_id` | `String` | @db.Uuid |
| `user_id` | `String?` | @db.Uuid |
| `redirect_uri` | `String` | - |
| `scope` | `String` | - |
| `state` | `String?` | - |
| `resource` | `String?` | - |
| `code_challenge` | `String?` | - |
| `code_challenge_method` | `code_challenge_method?` | - |
| `response_type` | `oauth_response_type` | @default(code) |
| `status` | `oauth_authorization_status` | @default(pending) |
| `authorization_code` | `String?` | @unique |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `expires_at` | `DateTime` | @default(dbgenerated("(now() + '00:03:00'::interval)")) @db.Timestamptz(6) |
| `approved_at` | `DateTime?` | @db.Timestamptz(6) |
| `nonce` | `String?` | - |
| `oauth_clients` | `oauth_clients` | @relation(fields: [client_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `users` | `users?` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## oauth_client_states

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `provider_type` | `String` | - |
| `code_verifier` | `String?` | - |
| `created_at` | `DateTime` | @db.Timestamptz(6) |

## oauth_clients

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `client_secret_hash` | `String?` | - |
| `registration_type` | `oauth_registration_type` | - |
| `redirect_uris` | `String` | - |
| `grant_types` | `String` | - |
| `client_name` | `String?` | - |
| `client_uri` | `String?` | - |
| `logo_uri` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `deleted_at` | `DateTime?` | @db.Timestamptz(6) |
| `client_type` | `oauth_client_type` | @default(confidential) |
| `token_endpoint_auth_method` | `String` | - |
| `oauth_authorizations` | `oauth_authorizations[]` | - |
| `oauth_consents` | `oauth_consents[]` | - |
| `sessions` | `sessions[]` | - |

## oauth_consents

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `client_id` | `String` | @db.Uuid |
| `scopes` | `String` | - |
| `granted_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `revoked_at` | `DateTime?` | @db.Timestamptz(6) |
| `oauth_clients` | `oauth_clients` | @relation(fields: [client_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## one_time_tokens

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `token_type` | `one_time_token_type` | - |
| `token_hash` | `String` | - |
| `relates_to` | `String` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamp(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamp(6) |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## refresh_tokens

| Field | Type | Attributes / Relations |
|---|---|---|
| `instance_id` | `String?` | @db.Uuid |
| `id` | `BigInt` | @id @default(autoincrement()) |
| `token` | `String?` | @unique(map: "refresh_tokens_token_unique") @db.VarChar(255) |
| `user_id` | `String?` | @db.VarChar(255) |
| `revoked` | `Boolean?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `parent` | `String?` | @db.VarChar(255) |
| `session_id` | `String?` | @db.Uuid |
| `sessions` | `sessions?` | @relation(fields: [session_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## saml_providers

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `sso_provider_id` | `String` | @db.Uuid |
| `entity_id` | `String` | @unique |
| `metadata_xml` | `String` | - |
| `metadata_url` | `String?` | - |
| `attribute_mapping` | `Json?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `name_id_format` | `String?` | - |
| `sso_providers` | `sso_providers` | @relation(fields: [sso_provider_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## saml_relay_states

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `sso_provider_id` | `String` | @db.Uuid |
| `request_id` | `String` | - |
| `for_email` | `String?` | - |
| `redirect_to` | `String?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `flow_state_id` | `String?` | @db.Uuid |
| `flow_state` | `flow_state?` | @relation(fields: [flow_state_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `sso_providers` | `sso_providers` | @relation(fields: [sso_provider_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## schema_migrations

| Field | Type | Attributes / Relations |
|---|---|---|
| `version` | `String` | @id @db.VarChar(255) |

## sessions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `factor_id` | `String?` | @db.Uuid |
| `aal` | `aal_level?` | - |
| `not_after` | `DateTime?` | @db.Timestamptz(6) |
| `refreshed_at` | `DateTime?` | @db.Timestamp(6) |
| `user_agent` | `String?` | - |
| `ip` | `String?` | @db.Inet |
| `tag` | `String?` | - |
| `oauth_client_id` | `String?` | @db.Uuid |
| `refresh_token_hmac_key` | `String?` | - |
| `refresh_token_counter` | `BigInt?` | - |
| `scopes` | `String?` | - |
| `mfa_amr_claims` | `mfa_amr_claims[]` | - |
| `refresh_tokens` | `refresh_tokens[]` | - |
| `oauth_clients` | `oauth_clients?` | @relation(fields: [oauth_client_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## sso_domains

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `sso_provider_id` | `String` | @db.Uuid |
| `domain` | `String` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `sso_providers` | `sso_providers` | @relation(fields: [sso_provider_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## sso_providers

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `resource_id` | `String?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `disabled` | `Boolean?` | - |
| `saml_providers` | `saml_providers[]` | - |
| `saml_relay_states` | `saml_relay_states[]` | - |
| `sso_domains` | `sso_domains[]` | - |

## users

| Field | Type | Attributes / Relations |
|---|---|---|
| `instance_id` | `String?` | @db.Uuid |
| `id` | `String` | @id @db.Uuid |
| `aud` | `String?` | @db.VarChar(255) |
| `role` | `String?` | @db.VarChar(255) |
| `email` | `String?` | @db.VarChar(255) |
| `encrypted_password` | `String?` | @db.VarChar(255) |
| `email_confirmed_at` | `DateTime?` | @db.Timestamptz(6) |
| `invited_at` | `DateTime?` | @db.Timestamptz(6) |
| `confirmation_token` | `String?` | @db.VarChar(255) |
| `confirmation_sent_at` | `DateTime?` | @db.Timestamptz(6) |
| `recovery_token` | `String?` | @db.VarChar(255) |
| `recovery_sent_at` | `DateTime?` | @db.Timestamptz(6) |
| `email_change_token_new` | `String?` | @db.VarChar(255) |
| `email_change` | `String?` | @db.VarChar(255) |
| `email_change_sent_at` | `DateTime?` | @db.Timestamptz(6) |
| `last_sign_in_at` | `DateTime?` | @db.Timestamptz(6) |
| `raw_app_meta_data` | `Json?` | - |
| `raw_user_meta_data` | `Json?` | - |
| `is_super_admin` | `Boolean?` | - |
| `created_at` | `DateTime?` | @db.Timestamptz(6) |
| `updated_at` | `DateTime?` | @db.Timestamptz(6) |
| `phone` | `String?` | @unique |
| `phone_confirmed_at` | `DateTime?` | @db.Timestamptz(6) |
| `phone_change` | `String?` | @default("") |
| `phone_change_token` | `String?` | @default("") @db.VarChar(255) |
| `phone_change_sent_at` | `DateTime?` | @db.Timestamptz(6) |
| `confirmed_at` | `DateTime?` | @default(dbgenerated("LEAST(email_confirmed_at, phone_confirmed_at)")) @db.Timestamptz(6) |
| `email_change_token_current` | `String?` | @default("") @db.VarChar(255) |
| `email_change_confirm_status` | `Int?` | @default(0) @db.SmallInt |
| `banned_until` | `DateTime?` | @db.Timestamptz(6) |
| `reauthentication_token` | `String?` | @default("") @db.VarChar(255) |
| `reauthentication_sent_at` | `DateTime?` | @db.Timestamptz(6) |
| `is_sso_user` | `Boolean` | @default(false) |
| `deleted_at` | `DateTime?` | @db.Timestamptz(6) |
| `is_anonymous` | `Boolean` | @default(false) |
| `identities` | `identities[]` | - |
| `mfa_factors` | `mfa_factors[]` | - |
| `oauth_authorizations` | `oauth_authorizations[]` | - |
| `oauth_consents` | `oauth_consents[]` | - |
| `one_time_tokens` | `one_time_tokens[]` | - |
| `sessions` | `sessions[]` | - |
| `webauthn_challenges` | `webauthn_challenges[]` | - |
| `webauthn_credentials` | `webauthn_credentials[]` | - |
| `conversation_members` | `conversation_members[]` | - |
| `conversations` | `conversations[]` | - |
| `messages` | `messages[]` | - |
| `profiles` | `profiles?` | - |
| `thread_summaries` | `thread_summaries[]` | - |

## webauthn_challenges

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `user_id` | `String?` | @db.Uuid |
| `challenge_type` | `String` | - |
| `session_data` | `Json` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `expires_at` | `DateTime` | @db.Timestamptz(6) |
| `users` | `users?` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## webauthn_credentials

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `credential_id` | `Bytes` | @unique |
| `public_key` | `Bytes` | - |
| `attestation_type` | `String` | @default("") |
| `aaguid` | `String?` | @db.Uuid |
| `sign_count` | `BigInt` | @default(0) |
| `transports` | `Json` | @default("[]") |
| `backup_eligible` | `Boolean` | @default(false) |
| `backed_up` | `Boolean` | @default(false) |
| `friendly_name` | `String` | @default("") |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `last_used_at` | `DateTime?` | @db.Timestamptz(6) |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## RevenueCutoverAudit

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id |
| `platform` | `String` | - |
| `legacyOwner` | `String` | - |
| `currentStatus` | `String` | - |
| `switchTriggered` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `firstDirectPay` | `DateTime?` | @db.Timestamptz(6) |

## TalentSubmission

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id |
| `fullName` | `String` | - |
| `email` | `String` | - |
| `phone` | `String` | - |
| `roleCategory` | `String` | - |
| `portfolioUrl` | `String` | - |
| `resumeText` | `String?` | - |
| `aiEvaluation` | `String?` | - |
| `matchRating` | `Int` | @default(0) |
| `createdAt` | `DateTime` | @default(now()) |

## account_transactions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `account_id` | `String` | @db.Uuid |
| `txn_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `direction` | `String` | - |
| `amount` | `Decimal` | @db.Decimal(15, 2) |
| `description` | `String?` | - |
| `reference` | `String?` | - |
| `entity_type` | `String?` | - |
| `entity_id` | `String?` | @db.Uuid |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `bank_accounts` | `bank_accounts` | @relation(fields: [account_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## ai_usage

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `feature` | `String` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |

## app_settings

| Field | Type | Attributes / Relations |
|---|---|---|
| `key` | `String` | @id |
| `value` | `String?` | - |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |

## artist_payout_ledger

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `line_item_id` | `String` | @db.Uuid |
| `artist_name` | `String` | - |
| `amount_owed` | `Decimal` | @db.Decimal(12, 4) |
| `paid_status` | `Boolean` | @default(false) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `artist_id` | `String?` | @db.Uuid |
| `statement_period` | `String?` | - |
| `artists` | `artists?` | @relation(fields: [artist_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `raw_earning_line_items` | `raw_earning_line_items` | @relation(fields: [line_item_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## artists

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `name` | `String` | - |
| `email` | `String` | @unique |
| `profile_photo` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `artist_payout_ledger` | `artist_payout_ledger[]` | - |
| `contracts` | `contracts[]` | - |
| `releases` | `releases[]` | - |
| `royalty_splits` | `royalty_splits[]` | - |

## audit_logs

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `action` | `String` | - |
| `entity_type` | `String` | - |
| `entity_id` | `String` | - |
| `old_values` | `Json?` | - |
| `new_values` | `Json?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## bank_accounts

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `name` | `String` | - |
| `account_type` | `String` | @default("bank") |
| `account_number` | `String?` | - |
| `ifsc` | `String?` | - |
| `opening_balance` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `current_balance` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `is_active` | `Boolean` | @default(true) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `account_transactions` | `account_transactions[]` | - |
| `bank_transactions` | `bank_transactions[]` | - |

## bank_transactions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `account_id` | `String?` | @db.Uuid |
| `txn_date` | `DateTime` | @db.Date |
| `description` | `String?` | - |
| `reference` | `String?` | - |
| `amount` | `Decimal` | @db.Decimal(15, 2) |
| `matched_type` | `String?` | - |
| `matched_id` | `String?` | @db.Uuid |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `bank_accounts` | `bank_accounts?` | @relation(fields: [account_id], references: [id], onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## box_office_collections

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `day_number` | `Int?` | - |
| `collection_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `india_net` | `Decimal?` | @db.Decimal(15, 2) |
| `worldwide_gross` | `Decimal?` | @db.Decimal(15, 2) |
| `screens` | `Int?` | - |
| `occupancy` | `Decimal?` | @db.Decimal(5, 2) |
| `source` | `String?` | - |
| `confirmed` | `Boolean` | @default(true) |
| `notes` | `String?` | - |
| `recorded_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [recorded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## budget_lines

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `section` | `String` | @default("below_line") |
| `phase` | `String` | @default("production") |
| `head` | `String` | - |
| `estimated` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `notes` | `String?` | - |
| `sort_order` | `Int` | @default(0) |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `payment_requests` | `payment_requests[]` | - |
| `petty_cash_txns` | `petty_cash_txns[]` | - |
| `project_crew` | `project_crew[]` | - |

## call_sheets

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `schedule_day_id` | `String` | @db.Uuid |
| `sent_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `channels` | `String?` | - |
| `recipients` | `Int?` | @default(0) |
| `sent_by` | `String?` | @db.Uuid |
| `body` | `String?` | - |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `project_schedule` | `project_schedule` | @relation(fields: [schedule_day_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [sent_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## campaign_assets

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `asset_type` | `String` | - |
| `title` | `String` | - |
| `url` | `String?` | - |
| `released_on` | `DateTime?` | @db.Date |
| `ai_summary` | `String?` | - |
| `ai_metrics` | `Json?` | - |
| `last_checked` | `DateTime?` | @db.Timestamptz(6) |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## cash_entries

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `entry_date` | `DateTime` | @db.Date |
| `opening_cash` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `cash_in` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `cash_out` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `closing_cash` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `entered_by` | `String` | @db.Uuid |
| `notes` | `String?` | - |
| `proof_file_url` | `String?` | - |
| `proof_file_name` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [entered_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## comments

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `entity_type` | `String` | - |
| `entity_id` | `String` | @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `content` | `String` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## contracts

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `title` | `String` | - |
| `territory` | `String?` | - |
| `recoupable_advance` | `Decimal?` | @db.Decimal(12, 2) |
| `file_url` | `String?` | - |
| `artist_id` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `artists` | `artists?` | @relation(fields: [artist_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## conversation_members

| Field | Type | Attributes / Relations |
|---|---|---|
| `conversation_id` | `String` | @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `role` | `String` | @default("member") |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `conversations` | `conversations` | @relation(fields: [conversation_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## conversations

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `created_by` | `String` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `conversation_members` | `conversation_members[]` | - |
| `users` | `users` | @relation(fields: [created_by], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `messages` | `messages[]` | - |
| `thread_summaries` | `thread_summaries[]` | - |

## crew_payments

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `crew_id` | `String` | @db.Uuid |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `payment_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `type` | `String` | @default("advance") |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `project_crew` | `project_crew` | @relation(fields: [crew_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## day_checklist

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `schedule_day_id` | `String` | @db.Uuid |
| `item` | `String` | - |
| `owner_dept` | `String?` | - |
| `done` | `Boolean` | @default(false) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `project_schedule` | `project_schedule` | @relation(fields: [schedule_day_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## day_requirements

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `schedule_day_id` | `String` | @db.Uuid |
| `category` | `String` | @default("equipment") |
| `label` | `String` | - |
| `qty` | `Int?` | @default(1) |
| `dept` | `String?` | - |
| `status` | `String` | @default("pending") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `project_schedule` | `project_schedule` | @relation(fields: [schedule_day_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## document_files

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `document_id` | `String` | @db.Uuid |
| `file_name` | `String` | - |
| `file_url` | `String` | - |
| `file_size` | `Int?` | - |
| `uploaded_by` | `String` | @db.Uuid |
| `uploaded_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `documents` | `documents` | @relation(fields: [document_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles` | @relation(fields: [uploaded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## documents

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String?` | @db.Uuid |
| `document_type` | `String` | @default("other") |
| `title` | `String` | - |
| `party_name` | `String?` | - |
| `document_date` | `DateTime?` | @db.Date |
| `expiry_date` | `DateTime?` | @db.Date |
| `renewal_date` | `DateTime?` | @db.Date |
| `amount_linked` | `Decimal?` | @db.Decimal(15, 2) |
| `status` | `String` | @default("draft") |
| `notes` | `String?` | - |
| `uploaded_by` | `String` | @db.Uuid |
| `access_level` | `String` | @default("project_team") |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `ai_summary` | `String?` | - |
| `ai_analysis` | `Json?` | - |
| `ai_analyzed_at` | `DateTime?` | @db.Timestamptz(6) |
| `document_files` | `document_files[]` | - |
| `projects` | `projects?` | @relation(fields: [project_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `profiles` | `profiles` | @relation(fields: [uploaded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## error_logs

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `context` | `String` | - |
| `message` | `String` | - |
| `stack` | `String?` | - |
| `meta` | `Json?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |

## financial_reports

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `reporting_month` | `DateTime` | @db.Timestamptz(6) |
| `total_raw_revenue` | `Decimal` | @db.Decimal(12, 2) |
| `ingested_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `raw_earning_line_items` | `raw_earning_line_items[]` | - |

## funding_transactions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `funding_id` | `String` | @db.Uuid |
| `txn_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `type` | `String` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `project_funding` | `project_funding` | @relation(fields: [funding_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## gst_inputs

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `source_owner` | `String?` | @db.Uuid |
| `vendor` | `String?` | - |
| `gstin` | `String?` | - |
| `invoice_no` | `String?` | - |
| `invoice_date` | `DateTime?` | @db.Date |
| `taxable_value` | `Decimal?` | @db.Decimal(15, 2) |
| `gst_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `total` | `Decimal?` | @db.Decimal(15, 2) |
| `snapshot_url` | `String?` | - |
| `category` | `String?` | - |
| `notes` | `String?` | - |
| `filed` | `Boolean` | @default(false) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [source_owner], references: [id], onUpdate: NoAction) |

## industry_films

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `title` | `String` | - |
| `release_date` | `DateTime?` | @db.Date |
| `days` | `Json` | @default("[]") |
| `ai_note` | `String?` | - |
| `total_india` | `Decimal?` | @db.Decimal(15, 2) |
| `last_checked` | `DateTime?` | @db.Timestamptz(6) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |

## ledgers

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `name` | `String` | @unique |
| `parent` | `String` | @default("Suspense A/c") |
| `opening_balance` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## liabilities

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `party_name` | `String` | - |
| `amount_owed` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `amount_paid` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `balance_remaining` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `original_date` | `DateTime` | @db.Date |
| `due_date` | `DateTime?` | @db.Date |
| `project_id` | `String?` | @db.Uuid |
| `type` | `String` | @default("other") |
| `priority` | `String` | @default("normal") |
| `status` | `String` | @default("unpaid") |
| `notes` | `String?` | - |
| `created_by` | `String` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects?` | @relation(fields: [project_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `liability_payments` | `liability_payments[]` | - |

## liability_payments

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `liability_id` | `String` | @db.Uuid |
| `amount` | `Decimal` | @db.Decimal(15, 2) |
| `payment_date` | `DateTime` | @db.Date |
| `paid_by` | `String` | @db.Uuid |
| `notes` | `String?` | - |
| `receipt_url` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `liabilities` | `liabilities` | @relation(fields: [liability_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles` | @relation(fields: [paid_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## locations

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `name` | `String` | - |
| `address` | `String?` | - |
| `map_link` | `String?` | - |
| `contact` | `String?` | - |
| `permit_status` | `String?` | @default("pending") |
| `nearest_hospital` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `project_schedule` | `project_schedule[]` | - |
| `scenes` | `scenes[]` | - |

## messages

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `conversation_id` | `String` | @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `body` | `String` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `conversations` | `conversations` | @relation(fields: [conversation_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `users` | `users` | @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## monitoring_findings

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `scan_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `category` | `String` | - |
| `severity` | `String` | @default("low") |
| `title` | `String` | - |
| `detail` | `String?` | - |
| `url` | `String?` | - |
| `dismissed` | `Boolean` | @default(false) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## notifications

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `user_id` | `String` | @db.Uuid |
| `title` | `String` | - |
| `body` | `String?` | - |
| `is_read` | `Boolean` | @default(false) |
| `entity_type` | `String?` | - |
| `entity_id` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## opm_records_channels

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `name` | `String` | - |
| `platform` | `String` | - |
| `handle` | `String?` | - |
| `url` | `String` | - |
| `subscriber_count` | `Int?` | @default(0) |
| `views_count` | `BigInt?` | @default(0) |
| `status` | `String` | @default("active") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `opm_records_videos` | `opm_records_videos[]` | - |

## opm_records_royalties

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `title_id` | `String?` | @db.Uuid |
| `platform` | `String` | - |
| `period` | `String` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `streams_count` | `Int?` | - |
| `payout_status` | `String` | @default("pending") |
| `statement_file_path` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `royalty_type` | `String?` | @default("master") |
| `opm_records_titles` | `opm_records_titles?` | @relation(fields: [title_id], references: [id], onUpdate: NoAction) |

## opm_records_titles

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `title` | `String` | - |
| `album_movie` | `String` | - |
| `release_date` | `DateTime?` | @db.Date |
| `artists` | `String?` | - |
| `isrc` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `upc` | `String?` | - |
| `label` | `String?` | @default("OPM Records") |
| `ownership_type` | `String?` | @default("owned") |
| `master_owner` | `String?` | - |
| `publishing_owner` | `String?` | - |
| `composer` | `String?` | - |
| `lyricist` | `String?` | - |
| `splits` | `String?` | - |
| `content_id` | `String?` | @default("unknown") |
| `sync_status` | `String?` | @default("available") |
| `youtube_url` | `String?` | - |
| `spotify_url` | `String?` | - |
| `apple_music_url` | `String?` | - |
| `instagram_url` | `String?` | - |
| `facebook_url` | `String?` | - |
| `imdb_url` | `String?` | - |
| `opm_records_royalties` | `opm_records_royalties[]` | - |

## opm_records_videos

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `channel_id` | `String` | @db.Uuid |
| `youtube_video_id` | `String` | @unique |
| `title` | `String` | - |
| `description` | `String?` | - |
| `published_at` | `DateTime?` | @db.Timestamptz(6) |
| `thumbnail_url` | `String?` | - |
| `view_count` | `BigInt?` | @default(0) |
| `like_count` | `Int?` | @default(0) |
| `comment_count` | `Int?` | @default(0) |
| `duration` | `String?` | - |
| `category` | `String?` | @default("other") |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `opm_records_channels` | `opm_records_channels` | @relation(fields: [channel_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## payment_requests

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `requested_by` | `String` | @db.Uuid |
| `payee` | `String` | - |
| `amount` | `Decimal` | @db.Decimal(15, 2) |
| `purpose` | `String` | - |
| `category` | `String?` | - |
| `due_date` | `DateTime?` | @db.Date |
| `bill_url` | `String?` | - |
| `bill_file_name` | `String?` | - |
| `verification_status` | `String` | @default("pending") |
| `verified_by` | `String?` | @db.Uuid |
| `verified_at` | `DateTime?` | @db.Timestamptz(6) |
| `approval_status` | `String` | @default("pending") |
| `approved_by` | `String?` | @db.Uuid |
| `approved_at` | `DateTime?` | @db.Timestamptz(6) |
| `payment_status` | `String` | @default("unpaid") |
| `paid_by` | `String?` | @db.Uuid |
| `paid_at` | `DateTime?` | @db.Timestamptz(6) |
| `receipt_url` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `payee_vendor_id` | `String?` | @db.Uuid |
| `gst_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `tds_percent` | `Decimal?` | @db.Decimal(5, 2) |
| `tds_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `net_payable` | `Decimal?` | @db.Decimal(15, 2) |
| `budget_line_id` | `String?` | @db.Uuid |
| `tds_section` | `String?` | - |
| `paid_reference` | `String?` | - |
| `paid_mode` | `String?` | - |
| `profiles_payment_requests_approved_byToprofiles` | `profiles?` | @relation("payment_requests_approved_byToprofiles", fields: [approved_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `budget_lines` | `budget_lines?` | @relation(fields: [budget_line_id], references: [id], onUpdate: NoAction) |
| `profiles_payment_requests_paid_byToprofiles` | `profiles?` | @relation("payment_requests_paid_byToprofiles", fields: [paid_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `vendors` | `vendors?` | @relation(fields: [payee_vendor_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `profiles_payment_requests_requested_byToprofiles` | `profiles` | @relation("payment_requests_requested_byToprofiles", fields: [requested_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `profiles_payment_requests_verified_byToprofiles` | `profiles?` | @relation("payment_requests_verified_byToprofiles", fields: [verified_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## personal_accounts

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `name` | `String` | - |
| `type` | `String` | @default("bank") |
| `balance` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `account_no` | `String?` | - |
| `ifsc` | `String?` | - |
| `branch` | `String?` | - |
| `bank_name` | `String?` | - |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_capital_gains

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `asset` | `String` | - |
| `buy_date` | `DateTime?` | @db.Date |
| `buy_amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `sell_date` | `DateTime?` | @db.Date |
| `sell_amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `gain_type` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_cards

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `issuer` | `String` | - |
| `last4` | `String?` | - |
| `card_limit` | `Decimal?` | @db.Decimal(15, 2) |
| `statement_day` | `Int?` | - |
| `due_day` | `Int?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_company_ledger

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `entity` | `String` | @default("OPM Cinemas") |
| `direction` | `String` | - |
| `kind` | `String` | @default("loan") |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `txn_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `status` | `String` | @default("open") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_deductions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `section` | `String` | @default("80C") |
| `label` | `String` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `fy` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_delegates

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `delegate_user_id` | `String` | @db.Uuid |
| `can_view` | `Boolean` | @default(true) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles_personal_delegates_delegate_user_idToprofiles` | `profiles` | @relation("personal_delegates_delegate_user_idToprofiles", fields: [delegate_user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles_personal_delegates_owner_idToprofiles` | `profiles` | @relation("personal_delegates_owner_idToprofiles", fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_documents

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `title` | `String` | - |
| `doc_type` | `String` | @default("other") |
| `file_path` | `String?` | - |
| `file_name` | `String?` | - |
| `ai_summary` | `String?` | - |
| `key_dates` | `Json?` | - |
| `expiry_date` | `DateTime?` | @db.Date |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_film_stakes

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `film` | `String` | - |
| `entity` | `String?` | - |
| `ownership_pct` | `Decimal` | @default(0) @db.Decimal(5, 2) |
| `investment` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `profit_share_terms` | `String?` | - |
| `status` | `String` | @default("active") |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_guarantees

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `lender` | `String` | - |
| `borrower` | `String` | @default("OPM Cinemas") |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `start_date` | `DateTime?` | @db.Date |
| `expiry_date` | `DateTime?` | @db.Date |
| `status` | `String` | @default("active") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_health_policies

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `insurer` | `String` | - |
| `policy_number` | `String?` | - |
| `kind` | `String` | @default("health") |
| `sum_insured` | `Decimal?` | @db.Decimal(15, 2) |
| `premium` | `Decimal?` | @db.Decimal(15, 2) |
| `renewal_date` | `DateTime?` | @db.Date |
| `members` | `String?` | - |
| `nominee` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_legal_cases

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `title` | `String` | - |
| `case_type` | `String` | @default("civil") |
| `our_role` | `String` | @default("petitioner") |
| `opposing_party` | `String?` | - |
| `related_entity` | `String?` | - |
| `related_project_id` | `String?` | @db.Uuid |
| `court` | `String?` | - |
| `case_number` | `String?` | - |
| `jurisdiction` | `String?` | - |
| `amount_involved` | `Decimal?` | @db.Decimal(15, 2) |
| `status` | `String` | @default("active") |
| `filing_date` | `DateTime?` | @db.Date |
| `next_hearing_date` | `DateTime?` | @db.Date |
| `lawyer_name` | `String?` | - |
| `lawyer_contact` | `String?` | - |
| `ai_summary` | `String?` | - |
| `ai_key_dates` | `Json?` | - |
| `notes` | `String?` | - |
| `file_path` | `String?` | - |
| `file_name` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `projects` | `projects?` | @relation(fields: [related_project_id], references: [id], onUpdate: NoAction) |

## personal_recurring

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `label` | `String` | - |
| `category` | `String` | @default("other") |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `due_day` | `Int?` | - |
| `autopay` | `Boolean` | @default(false) |
| `last_paid_month` | `String?` | - |
| `active` | `Boolean` | @default(true) |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_royalties

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `film` | `String` | - |
| `source` | `String` | @default("satellite") |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `expected_date` | `DateTime?` | @db.Date |
| `received_date` | `DateTime?` | @db.Date |
| `status` | `String` | @default("expected") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_synced_emails

| Field | Type | Attributes / Relations |
|---|---|---|
| `owner_id` | `String` | @db.Uuid |
| `message_id` | `String` | - |
| `processed_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_tax_items

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `kind` | `String` | @default("advance_tax") |
| `label` | `String` | - |
| `fy` | `String?` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `due_date` | `DateTime?` | @db.Date |
| `status` | `String` | @default("pending") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_tax_profile

| Field | Type | Attributes / Relations |
|---|---|---|
| `owner_id` | `String` | @id @db.Uuid |
| `pan` | `String?` | - |
| `regime` | `String` | @default("new") |
| `fy` | `String?` | - |
| `notes` | `String?` | - |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_transactions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `source` | `String` | @default("card") |
| `account_label` | `String?` | - |
| `txn_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `merchant` | `String?` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `direction` | `String` | @default("debit") |
| `category` | `String?` | - |
| `notes` | `String?` | - |
| `email_ref` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `origin` | `String` | @default("manual") |
| `dup_of` | `String?` | @db.Uuid |
| `reconciled` | `Boolean` | @default(false) |
| `gstin` | `String?` | - |
| `gst_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `taxable_value` | `Decimal?` | @db.Decimal(15, 2) |
| `invoice_no` | `String?` | - |
| `snapshot_url` | `String?` | - |
| `gst_eligible` | `Boolean` | @default(false) |
| `sent_to_accounts` | `Boolean` | @default(false) |
| `personal_transactions` | `personal_transactions?` | @relation("personal_transactionsTopersonal_transactions", fields: [dup_of], references: [id], onUpdate: NoAction) |
| `other_personal_transactions` | `personal_transactions[]` | @relation("personal_transactionsTopersonal_transactions") |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## personal_vehicles

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `owner_id` | `String` | @db.Uuid |
| `name` | `String` | - |
| `reg_number` | `String?` | - |
| `vtype` | `String` | @default("car") |
| `insurance_expiry` | `DateTime?` | @db.Date |
| `road_tax_expiry` | `DateTime?` | @db.Date |
| `puc_expiry` | `DateTime?` | @db.Date |
| `fitness_expiry` | `DateTime?` | @db.Date |
| `registration_expiry` | `DateTime?` | @db.Date |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [owner_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## petty_cash_floats

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `holder_name` | `String` | - |
| `holder_user_id` | `String?` | @db.Uuid |
| `status` | `String` | @default("open") |
| `opened_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles_petty_cash_floats_created_byToprofiles` | `profiles?` | @relation("petty_cash_floats_created_byToprofiles", fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `profiles_petty_cash_floats_holder_user_idToprofiles` | `profiles?` | @relation("petty_cash_floats_holder_user_idToprofiles", fields: [holder_user_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `petty_cash_txns` | `petty_cash_txns[]` | - |

## petty_cash_txns

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `float_id` | `String` | @db.Uuid |
| `txn_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `type` | `String` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `head` | `String?` | - |
| `budget_line_id` | `String?` | @db.Uuid |
| `description` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `budget_lines` | `budget_lines?` | @relation(fields: [budget_line_id], references: [id], onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `petty_cash_floats` | `petty_cash_floats` | @relation(fields: [float_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## phase_tasks

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `phase` | `String` | - |
| `title` | `String` | - |
| `done` | `Boolean` | @default(false) |
| `done_at` | `DateTime?` | @db.Timestamptz(6) |
| `sort_order` | `Int` | @default(0) |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## production_reports

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `report_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `day_number` | `Int?` | - |
| `location` | `String?` | - |
| `call_time` | `String?` | - |
| `wrap_time` | `String?` | - |
| `scenes_planned` | `Int` | @default(0) |
| `scenes_completed` | `Int` | @default(0) |
| `shots_completed` | `Int?` | - |
| `cast_present` | `String?` | - |
| `crew_count` | `Int?` | - |
| `status` | `String` | @default("on_schedule") |
| `weather` | `String?` | - |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## profiles

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @db.Uuid |
| `email` | `String` | - |
| `full_name` | `String` | - |
| `role` | `String` | @default("production_manager") |
| `avatar_url` | `String?` | - |
| `is_active` | `Boolean` | @default(true) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `email_alerts` | `Boolean` | @default(true) |
| `whatsapp_alerts` | `Boolean` | @default(false) |
| `whatsapp_number` | `String?` | - |
| `muted_categories` | `String[]` | @default([]) |
| `account_transactions` | `account_transactions[]` | - |
| `audit_logs` | `audit_logs[]` | - |
| `bank_transactions` | `bank_transactions[]` | - |
| `box_office_collections` | `box_office_collections[]` | - |
| `budget_lines` | `budget_lines[]` | - |
| `call_sheets` | `call_sheets[]` | - |
| `campaign_assets` | `campaign_assets[]` | - |
| `cash_entries` | `cash_entries[]` | - |
| `comments` | `comments[]` | - |
| `crew_payments` | `crew_payments[]` | - |
| `document_files` | `document_files[]` | - |
| `documents` | `documents[]` | - |
| `funding_transactions` | `funding_transactions[]` | - |
| `gst_inputs` | `gst_inputs[]` | - |
| `ledgers` | `ledgers[]` | - |
| `liabilities` | `liabilities[]` | - |
| `liability_payments` | `liability_payments[]` | - |
| `notifications` | `notifications[]` | - |
| `payment_requests_payment_requests_approved_byToprofiles` | `payment_requests[]` | @relation("payment_requests_approved_byToprofiles") |
| `payment_requests_payment_requests_paid_byToprofiles` | `payment_requests[]` | @relation("payment_requests_paid_byToprofiles") |
| `payment_requests_payment_requests_requested_byToprofiles` | `payment_requests[]` | @relation("payment_requests_requested_byToprofiles") |
| `payment_requests_payment_requests_verified_byToprofiles` | `payment_requests[]` | @relation("payment_requests_verified_byToprofiles") |
| `personal_accounts` | `personal_accounts[]` | - |
| `personal_capital_gains` | `personal_capital_gains[]` | - |
| `personal_cards` | `personal_cards[]` | - |
| `personal_company_ledger` | `personal_company_ledger[]` | - |
| `personal_deductions` | `personal_deductions[]` | - |
| `personal_delegates_personal_delegates_delegate_user_idToprofiles` | `personal_delegates[]` | @relation("personal_delegates_delegate_user_idToprofiles") |
| `personal_delegates_personal_delegates_owner_idToprofiles` | `personal_delegates[]` | @relation("personal_delegates_owner_idToprofiles") |
| `personal_documents` | `personal_documents[]` | - |
| `personal_film_stakes` | `personal_film_stakes[]` | - |
| `personal_guarantees` | `personal_guarantees[]` | - |
| `personal_health_policies` | `personal_health_policies[]` | - |
| `personal_legal_cases` | `personal_legal_cases[]` | - |
| `personal_recurring` | `personal_recurring[]` | - |
| `personal_royalties` | `personal_royalties[]` | - |
| `personal_synced_emails` | `personal_synced_emails[]` | - |
| `personal_tax_items` | `personal_tax_items[]` | - |
| `personal_tax_profile` | `personal_tax_profile?` | - |
| `personal_transactions` | `personal_transactions[]` | - |
| `personal_vehicles` | `personal_vehicles[]` | - |
| `petty_cash_floats_petty_cash_floats_created_byToprofiles` | `petty_cash_floats[]` | @relation("petty_cash_floats_created_byToprofiles") |
| `petty_cash_floats_petty_cash_floats_holder_user_idToprofiles` | `petty_cash_floats[]` | @relation("petty_cash_floats_holder_user_idToprofiles") |
| `petty_cash_txns` | `petty_cash_txns[]` | - |
| `phase_tasks` | `phase_tasks[]` | - |
| `production_reports` | `production_reports[]` | - |
| `users` | `users` | @relation(fields: [id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `project_archival` | `project_archival[]` | - |
| `project_checkins` | `project_checkins[]` | - |
| `project_crew` | `project_crew[]` | - |
| `project_documents` | `project_documents[]` | - |
| `project_funding` | `project_funding[]` | - |
| `project_income` | `project_income[]` | - |
| `project_members_project_members_added_byToprofiles` | `project_members[]` | @relation("project_members_added_byToprofiles") |
| `project_members_project_members_user_idToprofiles` | `project_members[]` | @relation("project_members_user_idToprofiles") |
| `project_messages` | `project_messages[]` | - |
| `project_press_kit` | `project_press_kit[]` | - |
| `project_tasks_project_tasks_assignee_idToprofiles` | `project_tasks[]` | @relation("project_tasks_assignee_idToprofiles") |
| `project_tasks_project_tasks_created_byToprofiles` | `project_tasks[]` | @relation("project_tasks_created_byToprofiles") |
| `projects` | `projects[]` | - |
| `tds_challans` | `tds_challans[]` | - |
| `templates` | `templates[]` | - |
| `vehicle_documents` | `vehicle_documents[]` | - |
| `vehicle_logs` | `vehicle_logs[]` | - |
| `vehicles` | `vehicles[]` | - |
| `vendors` | `vendors[]` | - |
| `vouchers` | `vouchers[]` | - |

## project_archival

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `category` | `String` | - |
| `title` | `String` | - |
| `file_path` | `String?` | - |
| `file_name` | `String?` | - |
| `notes` | `String?` | - |
| `uploaded_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [uploaded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## project_auditions

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `character_id` | `String?` | @db.Uuid |
| `applicant_name` | `String` | - |
| `contact` | `String?` | - |
| `age` | `String?` | - |
| `location` | `String?` | - |
| `photo_url` | `String?` | - |
| `video_url` | `String?` | - |
| `ai_score` | `Int?` | - |
| `ai_notes` | `String?` | - |
| `status` | `String` | @default("new") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `project_characters` | `project_characters?` | @relation(fields: [character_id], references: [id], onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_channels

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String?` | @db.Uuid |
| `platform` | `String` | @default("youtube") |
| `handle` | `String?` | - |
| `url` | `String` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects?` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_characters

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `name` | `String` | - |
| `description` | `String?` | - |
| `age_range` | `String?` | - |
| `gender` | `String?` | - |
| `importance` | `String?` | @default("supporting") |
| `status` | `String` | @default("open") |
| `cast_actor` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `project_auditions` | `project_auditions[]` | - |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_checkins

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `author_id` | `String` | @db.Uuid |
| `checkin_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `summary` | `String` | - |
| `blockers` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [author_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_crew

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `name` | `String` | - |
| `role_title` | `String?` | - |
| `agreed_fee` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `tds_percent` | `Decimal` | @default(0) @db.Decimal(5, 2) |
| `budget_line_id` | `String?` | @db.Uuid |
| `phone` | `String?` | - |
| `email` | `String?` | - |
| `pan` | `String?` | - |
| `status` | `String` | @default("active") |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `crew_payments` | `crew_payments[]` | - |
| `budget_lines` | `budget_lines?` | @relation(fields: [budget_line_id], references: [id], onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_deal_memos

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `party_name` | `String` | - |
| `party_kind` | `String` | @default("crew") |
| `role_title` | `String?` | - |
| `fee` | `Decimal?` | @db.Decimal(15, 2) |
| `advance` | `Decimal?` | @db.Decimal(15, 2) |
| `tds_percent` | `Decimal?` | @db.Decimal(5, 2) |
| `terms` | `String?` | - |
| `status` | `String` | @default("draft") |
| `signed_file_path` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_deals

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `kind` | `String` | @default("theatrical") |
| `counterparty` | `String` | - |
| `territory` | `String?` | - |
| `mg_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `total_value` | `Decimal?` | @db.Decimal(15, 2) |
| `overflow_terms` | `String?` | - |
| `status` | `String` | @default("negotiating") |
| `received_amount` | `Decimal?` | @default(0) @db.Decimal(15, 2) |
| `received_date` | `DateTime?` | @db.Date |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_deliverables

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `item` | `String` | - |
| `target` | `String` | @default("general") |
| `status` | `String` | @default("pending") |
| `due_date` | `DateTime?` | @db.Date |
| `file_path` | `String?` | - |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_documents

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `title` | `String` | - |
| `doc_type` | `String` | @default("other") |
| `file_path` | `String?` | - |
| `file_name` | `String?` | - |
| `ai_summary` | `String?` | - |
| `ai_data` | `Json?` | - |
| `uploaded_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [uploaded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## project_funding

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `kind` | `String` | - |
| `name` | `String` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `equity_percent` | `Decimal?` | @db.Decimal(6, 3) |
| `interest_rate` | `Decimal?` | @db.Decimal(7, 4) |
| `interest_basis` | `String?` | @default("monthly") |
| `interest_method` | `String?` | @default("simple") |
| `start_date` | `DateTime?` | @db.Date |
| `tenure_months` | `Int?` | - |
| `status` | `String` | @default("active") |
| `contact_person` | `String?` | - |
| `contact_phone` | `String?` | - |
| `contact_email` | `String?` | - |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `funding_transactions` | `funding_transactions[]` | - |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_income

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `amount` | `Decimal` | @db.Decimal(15, 2) |
| `source` | `String` | - |
| `income_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `notes` | `String?` | - |
| `recorded_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `party` | `String?` | - |
| `territory` | `String?` | - |
| `gross_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `commission_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `expected_date` | `DateTime?` | @db.Date |
| `status` | `String` | @default("received") |
| `gst_amount` | `Decimal?` | @db.Decimal(15, 2) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [recorded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## project_members

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `user_id` | `String?` | @db.Uuid |
| `project_role` | `String` | @default("member") |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `added_by` | `String?` | @db.Uuid |
| `title` | `String?` | - |
| `member_name` | `String?` | - |
| `member_email` | `String?` | - |
| `member_phone` | `String?` | - |
| `team_group` | `String` | @default("production") |
| `profiles_project_members_added_byToprofiles` | `profiles?` | @relation("project_members_added_byToprofiles", fields: [added_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles_project_members_user_idToprofiles` | `profiles?` | @relation("project_members_user_idToprofiles", fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_messages

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `author_id` | `String` | @db.Uuid |
| `body` | `String` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles` | @relation(fields: [author_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_post_tasks

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `stage` | `String` | @default("edit") |
| `title` | `String` | - |
| `status` | `String` | @default("not_started") |
| `owner` | `String?` | - |
| `due_date` | `DateTime?` | @db.Date |
| `sort_order` | `Int?` | @default(0) |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## project_press_kit

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `kind` | `String` | @default("poster") |
| `title` | `String` | - |
| `file_path` | `String?` | - |
| `link` | `String?` | - |
| `notes` | `String?` | - |
| `uploaded_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `profiles` | `profiles?` | @relation(fields: [uploaded_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## project_schedule

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `shoot_date` | `DateTime` | @db.Date |
| `end_date` | `DateTime?` | @db.Date |
| `location` | `String?` | - |
| `scenes` | `String?` | - |
| `call_time` | `String?` | - |
| `unit` | `String?` | - |
| `status` | `String` | @default("planned") |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `day_number` | `Int?` | - |
| `location_id` | `String?` | @db.Uuid |
| `est_wrap` | `String?` | - |
| `weather` | `String?` | - |
| `sunrise` | `String?` | - |
| `sunset` | `String?` | - |
| `call_sheets` | `call_sheets[]` | - |
| `day_checklist` | `day_checklist[]` | - |
| `day_requirements` | `day_requirements[]` | - |
| `locations` | `locations?` | @relation(fields: [location_id], references: [id], onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `schedule_day_scenes` | `schedule_day_scenes[]` | - |

## project_tasks

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `title` | `String` | - |
| `description` | `String?` | - |
| `assignee_id` | `String?` | @db.Uuid |
| `status` | `String` | @default("todo") |
| `due_date` | `DateTime?` | @db.Date |
| `done` | `Boolean` | @default(false) |
| `done_at` | `DateTime?` | @db.Timestamptz(6) |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles_project_tasks_assignee_idToprofiles` | `profiles?` | @relation("project_tasks_assignee_idToprofiles", fields: [assignee_id], references: [id], onUpdate: NoAction) |
| `profiles_project_tasks_created_byToprofiles` | `profiles?` | @relation("project_tasks_created_byToprofiles", fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## projects

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `name` | `String` | - |
| `slug` | `String` | @unique |
| `status` | `String` | @default("development") |
| `description` | `String?` | - |
| `start_date` | `DateTime?` | @db.Date |
| `end_date` | `DateTime?` | @db.Date |
| `budget` | `Decimal?` | @db.Decimal(15, 2) |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `is_priority` | `Boolean` | @default(false) |
| `ai_status_reason` | `String?` | - |
| `ai_status_at` | `DateTime?` | @db.Timestamptz(6) |
| `release_date` | `DateTime?` | @db.Date |
| `release_screens` | `Int?` | - |
| `release_territory` | `String?` | - |
| `production_company` | `String?` | @default("OPM Cinemas Proprietorship") |
| `release_year` | `Int?` | - |
| `has_liabilities` | `Boolean?` | @default(false) |
| `imdb_url` | `String?` | - |
| `letterboxd_url` | `String?` | - |
| `instagram_url` | `String?` | - |
| `facebook_url` | `String?` | - |
| `box_office_collections` | `box_office_collections[]` | - |
| `budget_lines` | `budget_lines[]` | - |
| `call_sheets` | `call_sheets[]` | - |
| `campaign_assets` | `campaign_assets[]` | - |
| `documents` | `documents[]` | - |
| `liabilities` | `liabilities[]` | - |
| `locations` | `locations[]` | - |
| `monitoring_findings` | `monitoring_findings[]` | - |
| `payment_requests` | `payment_requests[]` | - |
| `personal_legal_cases` | `personal_legal_cases[]` | - |
| `petty_cash_floats` | `petty_cash_floats[]` | - |
| `phase_tasks` | `phase_tasks[]` | - |
| `production_reports` | `production_reports[]` | - |
| `project_archival` | `project_archival[]` | - |
| `project_auditions` | `project_auditions[]` | - |
| `project_channels` | `project_channels[]` | - |
| `project_characters` | `project_characters[]` | - |
| `project_checkins` | `project_checkins[]` | - |
| `project_crew` | `project_crew[]` | - |
| `project_deal_memos` | `project_deal_memos[]` | - |
| `project_deals` | `project_deals[]` | - |
| `project_deliverables` | `project_deliverables[]` | - |
| `project_documents` | `project_documents[]` | - |
| `project_funding` | `project_funding[]` | - |
| `project_income` | `project_income[]` | - |
| `project_members` | `project_members[]` | - |
| `project_messages` | `project_messages[]` | - |
| `project_post_tasks` | `project_post_tasks[]` | - |
| `project_press_kit` | `project_press_kit[]` | - |
| `project_schedule` | `project_schedule[]` | - |
| `project_tasks` | `project_tasks[]` | - |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `scene_elements` | `scene_elements[]` | - |
| `scenes` | `scenes[]` | - |
| `vehicle_logs` | `vehicle_logs[]` | - |
| `vehicles` | `vehicles[]` | - |

## raw_earning_line_items

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `report_id` | `String` | @db.Uuid |
| `isrc` | `String` | - |
| `platform` | `String` | - |
| `amount` | `Decimal` | @db.Decimal(12, 4) |
| `artist_payout_ledger` | `artist_payout_ledger[]` | - |
| `financial_reports` | `financial_reports` | @relation(fields: [report_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## releases

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `title` | `String` | - |
| `release_date` | `DateTime` | @db.Timestamptz(6) |
| `upc` | `String?` | @unique |
| `cover_art_url` | `String?` | - |
| `status` | `ReleaseStatus` | @default(DRAFT) |
| `artist_id` | `String` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `artists` | `artists` | @relation(fields: [artist_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `tracks` | `tracks[]` | - |

## royalty_splits

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `track_id` | `String` | @db.Uuid |
| `entity_name` | `String` | - |
| `percentage` | `Decimal` | @db.Decimal(5, 2) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `artist_id` | `String?` | @db.Uuid |
| `artists` | `artists?` | @relation(fields: [artist_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `tracks` | `tracks` | @relation(fields: [track_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## scene_elements

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `scene_id` | `String` | @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `category` | `String` | @default("prop") |
| `label` | `String` | - |
| `qty` | `Int?` | @default(1) |
| `notes` | `String?` | - |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `scenes` | `scenes` | @relation(fields: [scene_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## scenes

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `project_id` | `String` | @db.Uuid |
| `scene_no` | `String` | - |
| `int_ext` | `String?` | @default("INT") |
| `day_night` | `String?` | @default("DAY") |
| `location_id` | `String?` | @db.Uuid |
| `set_name` | `String?` | - |
| `page_eighths` | `Int?` | @default(0) |
| `synopsis` | `String?` | - |
| `status` | `String` | @default("unscheduled") |
| `sort_order` | `Int?` | @default(0) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `scene_elements` | `scene_elements[]` | - |
| `locations` | `locations?` | @relation(fields: [location_id], references: [id], onUpdate: NoAction) |
| `projects` | `projects` | @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `schedule_day_scenes` | `schedule_day_scenes[]` | - |

## schedule_day_scenes

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `schedule_day_id` | `String` | @db.Uuid |
| `scene_id` | `String` | @db.Uuid |
| `sort_order` | `Int?` | @default(0) |
| `scenes` | `scenes` | @relation(fields: [scene_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `project_schedule` | `project_schedule` | @relation(fields: [schedule_day_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## scheduled_tasks

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `task_name` | `String?` | - |
| `target_timestamp` | `DateTime?` | @db.Timestamptz(6) |
| `status` | `String?` | - |

## staff_salaries

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `person_name` | `String` | - |
| `role_title` | `String?` | - |
| `monthly_salary` | `Decimal` | @db.Decimal(15, 2) |
| `vendor_id` | `String?` | @db.Uuid |
| `is_active` | `Boolean` | @default(true) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `vendors` | `vendors?` | @relation(fields: [vendor_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## system_status

| Field | Type | Attributes / Relations |
|---|---|---|
| `key` | `String` | @id |
| `message` | `String?` | - |
| `detail` | `String?` | - |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |

## takeover_compliance

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `task_name` | `String` | - |
| `status` | `String` | - |
| `updated_at` | `DateTime?` | @default(now()) @db.Timestamptz(6) |

## tds_challans

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `deposit_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `period_month` | `String?` | - |
| `section` | `String?` | - |
| `amount` | `Decimal` | @default(0) @db.Decimal(15, 2) |
| `challan_no` | `String?` | - |
| `bsr_code` | `String?` | - |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## templates

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `name` | `String` | - |
| `category` | `String` | @default("other") |
| `description` | `String?` | - |
| `file_url` | `String` | - |
| `file_name` | `String?` | - |
| `file_size` | `BigInt?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## thread_summaries

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `conversation_id` | `String` | @db.Uuid |
| `summarized_by` | `String` | @db.Uuid |
| `summary` | `String` | - |
| `message_count` | `Int` | @default(0) |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `conversations` | `conversations` | @relation(fields: [conversation_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |
| `users` | `users` | @relation(fields: [summarized_by], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## tracks

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid |
| `title` | `String` | - |
| `isrc` | `String?` | @unique |
| `audio_url` | `String` | - |
| `explicit` | `Boolean` | @default(false) |
| `bpm` | `Int?` | - |
| `key` | `String?` | - |
| `genre` | `String?` | - |
| `release_id` | `String` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `primary_artists` | `String[]` | @default([]) |
| `composers` | `String[]` | @default([]) |
| `playback_singers` | `String[]` | @default([]) |
| `duration` | `Int?` | - |
| `royalty_splits` | `royalty_splits[]` | - |
| `releases` | `releases` | @relation(fields: [release_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## vehicle_documents

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `vehicle_id` | `String` | @db.Uuid |
| `doc_type` | `String` | @default("other") |
| `doc_number` | `String?` | - |
| `issue_date` | `DateTime?` | @db.Date |
| `expiry_date` | `DateTime?` | @db.Date |
| `file_url` | `String?` | - |
| `file_name` | `String?` | - |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `vehicles` | `vehicles` | @relation(fields: [vehicle_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## vehicle_logs

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `vehicle_id` | `String` | @db.Uuid |
| `log_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `type` | `String` | @default("trip") |
| `odometer_start` | `Decimal?` | @db.Decimal(10, 1) |
| `odometer_end` | `Decimal?` | @db.Decimal(10, 1) |
| `km` | `Decimal?` | @db.Decimal(10, 1) |
| `fuel_litres` | `Decimal?` | @db.Decimal(8, 2) |
| `amount` | `Decimal` | @default(0) @db.Decimal(12, 2) |
| `purpose` | `String?` | - |
| `driver_name` | `String?` | - |
| `project_id` | `String?` | @db.Uuid |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects?` | @relation(fields: [project_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `vehicles` | `vehicles` | @relation(fields: [vehicle_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## vehicles

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `reg_number` | `String` | - |
| `name` | `String?` | - |
| `vehicle_type` | `String` | @default("car") |
| `ownership` | `String` | @default("owned") |
| `owner_name` | `String?` | - |
| `hire_rate` | `Decimal?` | @db.Decimal(12, 2) |
| `hire_basis` | `String?` | - |
| `driver_name` | `String?` | - |
| `driver_phone` | `String?` | - |
| `project_id` | `String?` | @db.Uuid |
| `status` | `String` | @default("active") |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `owner_phone` | `String?` | - |
| `driver_union_id` | `String?` | - |
| `driver_license_no` | `String?` | - |
| `driver_license_expiry` | `DateTime?` | @db.Date |
| `vehicle_documents` | `vehicle_documents[]` | - |
| `vehicle_logs` | `vehicle_logs[]` | - |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |
| `projects` | `projects?` | @relation(fields: [project_id], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## vendors

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `name` | `String` | - |
| `phone` | `String?` | - |
| `email` | `String?` | - |
| `gst_number` | `String?` | - |
| `pan` | `String?` | - |
| `bank_account_name` | `String?` | - |
| `bank_account_number` | `String?` | - |
| `bank_ifsc` | `String?` | - |
| `upi_id` | `String?` | - |
| `notes` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `updated_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `payment_requests` | `payment_requests[]` | - |
| `staff_salaries` | `staff_salaries[]` | - |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## voucher_entries

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `voucher_id` | `String` | @db.Uuid |
| `ledger_name` | `String` | - |
| `dr` | `Boolean` | - |
| `amount` | `Decimal` | @db.Decimal(15, 2) |
| `sort_order` | `Int` | @default(0) |
| `vouchers` | `vouchers` | @relation(fields: [voucher_id], references: [id], onDelete: Cascade, onUpdate: NoAction) |

## vouchers

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid |
| `voucher_type` | `String` | - |
| `voucher_date` | `DateTime` | @default(dbgenerated("CURRENT_DATE")) @db.Date |
| `voucher_number` | `String?` | - |
| `narration` | `String?` | - |
| `created_by` | `String?` | @db.Uuid |
| `created_at` | `DateTime` | @default(now()) @db.Timestamptz(6) |
| `source_type` | `String?` | - |
| `source_id` | `String?` | @db.Uuid |
| `voucher_entries` | `voucher_entries[]` | - |
| `profiles` | `profiles?` | @relation(fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction) |

## wa_rate_limit

| Field | Type | Attributes / Relations |
|---|---|---|
| `phone` | `String` | @id |
| `count` | `Int` | @default(0) |
| `window_start` | `DateTime` | @default(now()) @db.Timestamptz(6) |

## MusicTitles

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `title` | `String` | - |
| `artist` | `String` | - |
| `isrc` | `String?` | @unique |
| `upc` | `String?` | - |
| `releaseDate` | `DateTime?` | - |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |
| `revenueSyncs` | `RevenueSync[]` | - |

## RevenueSync

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `musicTitleId` | `String` | - |
| `source` | `String` | // e.g., "LabelGrid", "YouTube", "Stripe" |
| `amount` | `Float` | - |
| `currency` | `String` | @default("INR") |
| `periodStart` | `DateTime` | - |
| `periodEnd` | `DateTime` | - |
| `syncDate` | `DateTime` | @default(now()) |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |
| `musicTitle` | `MusicTitles` | @relation(fields: [musicTitleId], references: [id]) |

## OfficeLedger

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `amount` | `Float` | - |
| `description` | `String?` | - |
| `transactionDate` | `DateTime` | @default(now()) |
| `tag` | `String?` | // e.g., "Transfer Ready" |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

## StaffClearance

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `taskName` | `String` | - |
| `assignedTo` | `String` | - |
| `isCleared` | `Boolean` | @default(false) |
| `requisitionDetails` | `String?` | - |
| `clearedAt` | `DateTime?` | - |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

## Pipelines

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `stage` | `String` | - |
| `milestone` | `String?` | - |
| `parameters` | `Json?` | - |
| `isActive` | `Boolean` | @default(true) |
| `createdAt` | `DateTime` | @default(now()) |
| `updated_at` | `DateTime` | @updatedAt @map("updated_at") |

## BelieveCatalogTakeover

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `upcCode` | `String?` | - |
| `releaseTitle` | `String` | - |
| `artistName` | `String` | - |
| `genre` | `String?` | - |
| `originalReleaseDate` | `DateTime?` | - |
| `migrationStatus` | `MigrationStatus` | @default(Staged) |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |
| `tracks` | `TrackMetadata[]` | - |

## TrackMetadata

| Field | Type | Attributes / Relations |
|---|---|---|
| `id` | `String` | @id @default(uuid()) |
| `takeoverId` | `String` | - |
| `isrcCode` | `String` | - |
| `trackTitle` | `String` | - |
| `duration` | `Int` | - |
| `audioWavUrl` | `String` | - |
| `artworkUrl` | `String` | - |
| `explicitContent` | `Boolean` | @default(false) |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |
| `takeover` | `BelieveCatalogTakeover` | @relation(fields: [takeoverId], references: [id], onDelete: Cascade) |

