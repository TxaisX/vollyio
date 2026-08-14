# Scoring scale report
Mode: **FITTED** from 11 coach-labeled clips
Corpus: 180 scored clips, 234 refused. Model: google/gemini-3.6-flash
Rank correlation model vs coach: **0.555** (this decides whether calibration is legitimate at all)
Mean absolute error after mapping: **2.4** points
## Gates
Verdict: **FAIL**
| gate | status | detail |
|---|---|---|
| median_in_target | pass | median 61 vs [50, 70] |
| range_used | pass | used 52 points, need 45 |
| spread_not_collapsed | fail | sd 7.8, need 12 |
| false_refusals | fail | 1/12 good clips refused (8.3%) |
| missed_refusals | fail | 5/5 unratable clips got a score anyway (100.0%) |
| abstain_lane_alive | pass | 35.3% of reads claimed every checkpoint visible |
| stability | pass | mean run-to-run spread 4.9 points, max 8 |
| noise_below_signal | fail | reliability 0.64 (read noise sd 3.5 against between-clip sd 5.9), need 0.75 |
## Distribution
| | n | min | p10 | median | p90 | max | sd | range used |
|---|---|---|---|---|---|---|---|---|
| raw (what ships today) | 180 | 48 | 74 | 81 | 89 | 96 | 5.9 | 48 |
| calibrated | 180 | 41 | 60 | 61 | 78 | 93 | 7.8 | 52 |
## Discrimination: raw score by footage level
The level is the SOURCE's claim about the athlete, not a label about the rep.
It cannot calibrate anything. It can show whether the model separates a
beginners' tutorial from professional footage at all.
| level | n | min | median | max | mean | sd | refused |
|---|---|---|---|---|---|---|---|
| developing | 25 | 68 | 81 | 96 | 81.7 | 6.1 | 45 |
| intermediate | 59 | 72 | 81 | 91 | 80.2 | 4.9 | 123 |
| advanced | 35 | 73 | 81 | 91 | 81.9 | 4.5 | 41 |
| pro | 16 | 48 | 88 | 91 | 83.5 | 10.5 | 24 |
| production | 45 | 71 | 78 | 92 | 79.3 | 5 | 1 |
## Anchors in force
| model says | player sees |
|---|---|
| 0 | 0 |
| 71 | 60 |
| 74 | 60 |
| 81 | 61 |
| 92 | 85 |
| 100 | 100 |
## Every clip, worst first
| clip | skill | shipped | model raw | coverage | proposed | coach |
|---|---|---|---|---|---|---|
| src-aaJNUKIgIQM-w3 | dig | - | 48 | 60% | **41** | cannot rate |
| src-EcDGpf8IoKM-w5 | dig | - | 68 | 100% | **57** | cannot rate |
| prod-cda226e1 | set | 73 | 76 | 100% | **60** |  |
| prod-cc267048 | set | 61 | 74 | 100% | **60** |  |
| prod-ea2e536e | attack | 65 | 74 | 100% | **60** |  |
| prod-910c0d77 | attack | 64 | 76 | 100% | **60** |  |
| prod-13ee336b | attack | 62 | 71 | 100% | **60** |  |
| prod-2c82a59e | set | 90 | 74 | 80% | **60** | band 6 |
| prod-21f56a0c | serve | 76 | 71 | 100% | **60** | band 6 |
| prod-705fb8c9 | attack | 51 | 74 | 100% | **60** |  |
| prod-10b14975 | attack | 52 | 77 | 100% | **60** |  |
| prod-8671aaec | attack | 78 | 76 | 100% | **60** |  |
| prod-dc008f22 | set | 76 | 73 | 100% | **60** |  |
| prod-70995c73 | serve | 71 | 72 | 100% | **60** |  |
| src-y7DboXOZDJs-w1 | attack | - | 74 | 100% | **60** |  |
| src-9a5LnBi8rro-w3 | block | - | 76 | 60% | **60** |  |
| src-twMHJhUqo80-w3 | dig | - | 73 | 100% | **60** |  |
| src-fGSgD2k-NEU-w3 | serve | - | 73 | 100% | **60** |  |
| src-zU12l62ME_w-w1 | serve | - | 76 | 100% | **60** |  |
| src--aDqyumtad0-w5 | set | - | 73 | 100% | **60** |  |
| src-tqFmaVEowBI-w7 | set | - | 76 | 80% | **60** |  |
| src-xfCoHL6HvdQ-w7 | pass | - | 73 | 100% | **60** |  |
| src-Rp9LknLjqpc-w5 | pass | - | 74 | 100% | **60** |  |
| src-WdFfGlxdyiE-w6 | block | - | 72 | 80% | **60** |  |
| src-psPc4JBs0PU-w2 | block | - | 76 | 100% | **60** |  |
| src-3NeaCi34GQU-w1 | block | - | 71 | 100% | **60** |  |
| src-psPc4JBs0PU-w7 | block | - | 76 | 60% | **60** |  |
| src-w7ncD5bpsXk-w2 | serve | - | 74 | 80% | **60** |  |
| src-MAFi2kguhYs-w4 | dig | - | 76 | 80% | **60** |  |
| src-V-eZzmaKc_w-w1 | dig | - | 74 | 100% | **60** |  |
| src-V-eZzmaKc_w-w3 | dig | - | 74 | 100% | **60** |  |
| src-V-eZzmaKc_w-w6 | dig | - | 74 | 100% | **60** |  |
| src-V-eZzmaKc_w-w7 | dig | - | 72 | 100% | **60** |  |
| src-VfiBnNToHIQ-w1 | dig | - | 72 | 80% | **60** |  |
| src-IAV0ltDhFzk-w5 | dig | - | 76 | 100% | **60** |  |
| src-IAV0ltDhFzk-w7 | dig | - | 76 | 100% | **60** |  |
| prod-2873531a | attack | 48 | 78 | 100% | **61** | band 6 |
| prod-45f6ee8b | attack | 48 | 81 | 100% | **61** | band 6 |
| prod-5189ea5e | attack | 42 | 78 | 100% | **61** |  |
| prod-da4dd9e5 | set | 75 | 78 | 100% | **61** |  |
| prod-db19ba5c | set | 75 | 79 | 100% | **61** |  |
| prod-4886ba9c | set | 60 | 78 | 100% | **61** |  |
| prod-18dbaece | set | 64 | 78 | 100% | **61** |  |
| prod-9435760b | attack | 63 | 81 | 100% | **61** |  |
| prod-01f707ac | set | 65 | 78 | 100% | **61** |  |
| prod-3858b2b4 | pass | 87 | 78 | 100% | **61** |  |
| prod-01657590 | attack | 76 | 79 | 100% | **61** | band 6 |
| prod-207a5a24 | set | 74 | 78 | 100% | **61** |  |
| prod-d9a34f8f | set | 77 | 81 | 100% | **61** | cannot rate |
| prod-20b66ca2 | attack | 68 | 78 | 100% | **61** |  |
| prod-02eb77fa | attack | 63 | 78 | 100% | **61** | band 6 |
| prod-204a9569 | attack | 0 | 81 | 100% | **61** |  |
| prod-1d9c1409 | attack | 61 | 79 | 100% | **61** |  |
| prod-22bee58a | attack | 86 | 79 | 100% | **61** | band 6 |
| prod-0ff74323 | set | 68 | 79 | 100% | **61** |  |
| prod-67d7d515 | attack | 74 | 79 | 100% | **61** |  |
| prod-9c5ceb12 | attack | 63 | 78 | 100% | **61** | band 6 |
| prod-eed9f542 | set | 79 | 81 | 100% | **61** |  |
| prod-c09f59f4 | attack | 76 | 81 | 100% | **61** |  |
| prod-28a1aa72 | set | 76 | 78 | 100% | **61** |  |
| src-qd5UVYmBjQM-w1 | serve | - | 79 | 100% | **61** |  |
| src-lEkr3qgIDlI-w2 | set | - | 81 | 100% | **61** |  |
| src-lEkr3qgIDlI-w6 | set | - | 81 | 80% | **61** |  |
| src-FMtUqoxfR50-w4 | attack | - | 81 | 100% | **61** |  |
| src-FMtUqoxfR50-w5 | attack | - | 81 | 100% | **61** |  |
| src-WSieqgGFfk0-w5 | attack | - | 78 | 60% | **61** |  |
| src-PZ6BYglNt2Y-w1 | serve | - | 78 | 100% | **61** |  |
| src-9a5LnBi8rro-w5 | block | - | 78 | 40% | **61** |  |
| src-fadS1Cjg58k-w3 | block | - | 81 | 100% | **61** |  |
| src-fadS1Cjg58k-w4 | block | - | 81 | 100% | **61** |  |
| src-fadS1Cjg58k-w5 | block | - | 81 | 100% | **61** |  |
| src-fadS1Cjg58k-w6 | block | - | 78 | 100% | **61** |  |
| src-d1aYvMBfE_o-w2 | block | - | 78 | 100% | **61** |  |
| src-d1aYvMBfE_o-w5 | block | - | 79 | 100% | **61** |  |
| src-d1aYvMBfE_o-w6 | block | - | 78 | 100% | **61** |  |
| src-oZ-VcYLAIxk-w1 | dig | - | 79 | 60% | **61** |  |
| src-twMHJhUqo80-w1 | dig | - | 81 | 80% | **61** |  |
| src-twMHJhUqo80-w4 | dig | - | 81 | 100% | **61** |  |
| src-twMHJhUqo80-w6 | dig | - | 81 | 100% | **61** |  |
| src-EcDGpf8IoKM-w6 | dig | - | 78 | 100% | **61** |  |
| src-hluYOAklfnI-w6 | dig | - | 78 | 100% | **61** |  |
| src-Rm0yvvBx7oc-w5 | pass | - | 79 | 100% | **61** |  |
| src-d1aYvMBfE_o-w7 | block | - | 81 | 100% | **61** |  |
| src-twMHJhUqo80-w7 | dig | - | 81 | 100% | **61** |  |
| src-EcDGpf8IoKM-w7 | dig | - | 81 | 100% | **61** |  |
| src-Rm0yvvBx7oc-w7 | pass | - | 81 | 100% | **61** |  |
| src-hluYOAklfnI-w7 | dig | - | 81 | 100% | **61** |  |
| src-fGSgD2k-NEU-w7 | serve | - | 78 | 100% | **61** |  |
| src-zU12l62ME_w-w2 | serve | - | 81 | 100% | **61** |  |
| src-zU12l62ME_w-w4 | serve | - | 78 | 100% | **61** |  |
| src-zU12l62ME_w-w5 | serve | - | 78 | 100% | **61** |  |
| src-zU12l62ME_w-w7 | serve | - | 78 | 100% | **61** |  |
| src--aDqyumtad0-w2 | set | - | 81 | 80% | **61** |  |
| src--aDqyumtad0-w6 | set | - | 81 | 100% | **61** |  |
| src-2SooJTzhDQo-w5 | set | - | 78 | 80% | **61** |  |
| src-xfCoHL6HvdQ-w5 | pass | - | 81 | 100% | **61** |  |
| src-9oqeCiBW-4o-w3 | pass | - | 79 | 100% | **61** |  |
| src-9oqeCiBW-4o-w5 | pass | - | 78 | 80% | **61** |  |
| src-9oqeCiBW-4o-w7 | pass | - | 79 | 100% | **61** |  |
| src-IFFZNgN2n5Q-w5 | pass | - | 81 | 100% | **61** |  |
| src-WdFfGlxdyiE-w4 | block | - | 81 | 100% | **61** |  |
| src-WdFfGlxdyiE-w7 | block | - | 78 | 60% | **61** |  |
| src-3NeaCi34GQU-w2 | block | - | 79 | 80% | **61** |  |
| src-w7ncD5bpsXk-w1 | serve | - | 78 | 100% | **61** |  |
| src-fJNgYeBJeD8-w6 | serve | - | 78 | 80% | **61** |  |
| src-4W56sp-HS30-w2 | set | - | 81 | 80% | **61** |  |
| src-4W56sp-HS30-w5 | set | - | 78 | 60% | **61** |  |
| src-2P7Rbdumu54-w4 | serve | - | 78 | 100% | **61** | band 7 |
| src-2P7Rbdumu54-w7 | serve | - | 81 | 100% | **61** |  |
| src-V-eZzmaKc_w-w2 | dig | - | 81 | 100% | **61** |  |
| src-V-eZzmaKc_w-w4 | dig | - | 78 | 100% | **61** |  |
| src-V-eZzmaKc_w-w5 | dig | - | 78 | 100% | **61** |  |
| src-D2PpiblF95s-w3 | dig | - | 81 | 100% | **61** |  |
| src-D2PpiblF95s-w2 | dig | - | 81 | 100% | **61** |  |
| src-D2PpiblF95s-w7 | dig | - | 81 | 100% | **61** |  |
| src-SWGhtifrWsU-w1 | serve | - | 82 | 100% | **63** |  |
| src-FMtUqoxfR50-w3 | attack | - | 82 | 100% | **63** |  |
| src-zU12l62ME_w-w3 | serve | - | 82 | 100% | **63** |  |
| src-dJbv0h6EH0o-w3 | pass | - | 82 | 100% | **63** |  |
| src-UForevjCu2Y-w4 | block | - | 82 | 60% | **63** |  |
| src-fJNgYeBJeD8-w3 | serve | - | 82 | 100% | **63** |  |
| src-MAFi2kguhYs-w6 | dig | - | 82 | 100% | **63** |  |
| prod-945b7103 | attack | 70 | 83 | 100% | **65** |  |
| prod-2b74cb9e | attack | 89 | 83 | 100% | **65** |  |
| src-o0AduQRRq-I-w3 | pass | - | 83 | 100% | **65** |  |
| src-FAW_oKzB71Q-w4 | attack | - | 83 | 100% | **65** |  |
| src-AOwk2QN0PdM-w3 | set | - | 83 | 80% | **65** |  |
| src-AOwk2QN0PdM-w6 | set | - | 83 | 100% | **65** |  |
| src-dJbv0h6EH0o-w4 | pass | - | 83 | 100% | **65** |  |
| src-aaJNUKIgIQM-w5 | dig | - | 83 | 100% | **65** |  |
| src-aaJNUKIgIQM-w6 | dig | - | 83 | 100% | **65** |  |
| src-1wLydAdm0V8-w5 | pass | - | 83 | 100% | **65** |  |
| src-fJNgYeBJeD8-w4 | serve | - | 83 | 100% | **65** |  |
| prod-ef4f5e7c | attack | 83 | 84 | 100% | **68** |  |
| src-FMtUqoxfR50-w6 | attack | - | 84 | 100% | **68** |  |
| src-o0AduQRRq-I-w4 | pass | - | 84 | 100% | **68** |  |
| src-7yseUMmvKPw-w1 | serve | - | 84 | 100% | **68** |  |
| src-9a5LnBi8rro-w2 | block | - | 84 | 60% | **68** |  |
| src-hluYOAklfnI-w5 | dig | - | 84 | 100% | **68** |  |
| src-YAoE8H_QFV8-w6 | dig | - | 84 | 100% | **68** |  |
| src-D2PpiblF95s-w6 | dig | - | 84 | 100% | **68** |  |
| prod-cd3fe7d8 | attack | 89 | 85 | 100% | **70** |  |
| src-D2PpiblF95s-w5 | dig | - | 86 | 100% | **72** |  |
| prod-5e3775e0 | attack | 53 | 88 | 100% | **76** |  |
| src-MPmRiCadruU-w2 | serve | - | 88 | 80% | **76** |  |
| src-WhXt-RqHQIM-w4 | serve | - | 88 | 100% | **76** |  |
| src-WhXt-RqHQIM-w6 | serve | - | 88 | 100% | **76** |  |
| src-WhXt-RqHQIM-w5 | serve | - | 88 | 80% | **76** |  |
| src-o0AduQRRq-I-w5 | pass | - | 88 | 100% | **76** |  |
| src-3DkpSA5CkbY-w5 | block | - | 88 | 100% | **76** |  |
| src-tGzr7ArpY9Y-w2 | serve | - | 88 | 100% | **76** |  |
| src-tGzr7ArpY9Y-w4 | serve | - | 88 | 100% | **76** |  |
| src-UForevjCu2Y-w5 | block | - | 88 | 80% | **76** |  |
| src-UForevjCu2Y-w7 | block | - | 88 | 60% | **76** |  |
| src-4W56sp-HS30-w3 | set | - | 88 | 100% | **76** |  |
| src-2P7Rbdumu54-w3 | serve | - | 88 | 100% | **76** |  |
| src-D2PpiblF95s-w4 | dig | - | 88 | 100% | **76** |  |
| src-IAV0ltDhFzk-w6 | dig | - | 88 | 100% | **76** |  |
| prod-4e78b124 | attack | 70 | 89 | 100% | **78** |  |
| src-FAW_oKzB71Q-w2 | attack | - | 89 | 100% | **78** |  |
| src-FAW_oKzB71Q-w5 | attack | - | 89 | 100% | **78** |  |
| src-FAW_oKzB71Q-w6 | attack | - | 89 | 100% | **78** |  |
| src-9a5LnBi8rro-w1 | block | - | 89 | 60% | **78** |  |
| src-3DkpSA5CkbY-w1 | block | - | 89 | 80% | **78** |  |
| src-3DkpSA5CkbY-w4 | block | - | 89 | 100% | **78** |  |
| src-tGzr7ArpY9Y-w6 | serve | - | 89 | 100% | **78** |  |
| src-4W56sp-HS30-w6 | set | - | 89 | 60% | **78** |  |
| prod-7f0fbc23 | attack | 81 | 90 | 100% | **81** |  |
| src-UForevjCu2Y-w2 | block | - | 91 | 60% (capped) | **82** |  |
| src-WhXt-RqHQIM-w2 | serve | - | 91 | 100% | **83** |  |
| src-kgXAm48Ash0-w3 | serve | - | 91 | 100% | **83** | band 9 |
| src-WhXt-RqHQIM-w7 | serve | - | 91 | 100% | **83** |  |
| src-FAW_oKzB71Q-w7 | attack | - | 91 | 80% | **83** |  |
| src-s6D8aVaf65o-w1 | serve | - | 91 | 100% | **83** |  |
| src-s6D8aVaf65o-w6 | serve | - | 91 | 100% | **83** |  |
| src-tGzr7ArpY9Y-w7 | serve | - | 91 | 100% | **83** |  |
| src-WdFfGlxdyiE-w3 | block | - | 91 | 100% | **83** | cannot rate |
| prod-40ca3c40 | attack | 75 | 92 | 100% | **85** |  |
| prod-a49925a7 | attack | 89 | 92 | 100% | **85** | band 8 |
| src-WhXt-RqHQIM-w1 | serve | - | 96 | 100% | **93** | cannot rate |