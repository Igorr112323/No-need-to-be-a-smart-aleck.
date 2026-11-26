# Corpus Report — 2026-11-26 18:23 UTC — 100 моделей (limit 100, 16³→32³ 120с, 150k, матрица 4×25)

**Дата:** 2026-11-26 18:23 UTC  
**Parse ok:** 100/100 (100.0%) — цель ≥90%  
**Watertight:** 87/100  
**Voxel 48³:** 99/100  
**Solve 16³→32³ 120с, 150k:** 86/100 — цель ≥85/100 (F2), иначе BUG_LIST  
**Инженерных ok:** 75/100 — цель ≥25 (корпуса/кронштейны/пластины с отв.)  
**Время среднее:** 6.76с, всего 11.3 мин  
**Память:** ~676 МБ пик (оценка)  

| файл | лицензия | cat | parse | wat. | voxel | solve 120с | σmax МПа | safety | вес г до→после (-%) | время | res | итог |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openlight_bracket_proc.stl | MIT (OpenLight) | bracket | True | True | True | True 4.58 | 0.0 | 99.0 | 452.9→254.5 (43.8%) | 4.701 | 16 | ok |
| openlight_uav_arm.stl | MIT (OpenLight) | uav_bracket | True | True | True | True 0.27 | 0.0 | 99.0 | 135.4→75.6 (44.2%) | 0.312 | 16 | ok |
| openlight_thin_plate.stl | MIT (OpenLight) | thinwall | True | True | True | True 1.2 | 0.0 | 99.0 | 119.6→66.1 (44.8%) | 1.332 | 16 | ok |
| openlight_gear_12t.stl | MIT (OpenLight) | gear | True | True | True | True 13.69 | 12829.03 | 0.3 | 0.0→0.0 (48.0%) | 13.745 | 16 | ok |
| openlight_housing_box.stl | MIT (OpenLight) | housing | True | True | True | True 15.05 | 7.98 | 43.25 | 125.8→70.0 (44.4%) | 15.268 | 16 | ok |
| openlight_hinge_simple.stl | MIT (OpenLight) | hinge | True | True | True | True 3.54 | 68.11 | 5.07 | 9.5→5.4 (43.5%) | 3.946 | 16 | ok |
| openlight_lattice.stl | MIT (OpenLight) | thinwall | True | True | True | True 0.98 | 0.0 | 99.0 | 119.6→66.1 (44.8%) | 1.102 | 16 | ok |
| openlight_bracket_v2.stl | MIT (OpenLight) | bracket | True | True | True | True 4.32 | 0.0 | 99.0 | 452.9→254.5 (43.8%) | 4.416 | 16 | ok |
| openlight_uav_frame.stl | MIT (OpenLight) | uav_bracket | True | True | True | True 0.35 | 0.0 | 99.0 | 135.4→75.6 (44.2%) | 0.395 | 16 | ok |
| openlight_bracket_heavy.stl | MIT (OpenLight) | bracket | True | True | True | True 4.08 | 0.0 | 99.0 | 452.9→254.5 (43.8%) | 4.164 | 16 | ok |
| trimesh_1002_tray_bottom.STL | BSD (trimesh) | thinwall | True | True | True | True 1.28 | 1.64 | 99.0 | 21458.3→11950.0 (44.3%) | 1.504 | 16 | ok |
| trimesh_20mm_cube.stl | BSD (trimesh) | thinwall | True | True | True | True 23.25 | 81.18 | 4.25 | 24.5→13.9 (43.4%) | 23.885 | 16 | ok |
| trimesh_7_8ths_cube.stl | BSD (trimesh) | thinwall | True | True | True | True 23.57 | 19.33 | 17.85 | 188.6→105.6 (44.0%) | 23.986 | 16 | ok |
| trimesh_ADIS16480.STL | BSD (trimesh) | housing | True | True | True | True 7.22 | 15009076.08 | 0.3 | 0.0→0.0 (43.2%) | 9.164 | 16 | ok |
| trimesh_angle_block.STL | BSD (trimesh) | bracket | True | True | True | True 15.38 | 25172.5 | 0.3 | 0.0→0.0 (42.0%) | 16.212 | 16 | ok |
| trimesh_box.STL | BSD (trimesh) | housing | True | True | True | True 9.79 | 1001.61 | 0.34 | 0.6→0.3 (44.0%) | 10.846 | 16 | ok |
| trimesh_busted.STL | BSD (trimesh) | organic | True | True | True | True 10.7 | 1293.96 | 0.3 | 2.5→1.3 (47.1%) | 10.836 | 16 | ok |
| trimesh_counter.STL | BSD (trimesh) | housing | True | True | True | True 2.7 | 0.21 | 99.0 | 25669.4→14664.0 (42.9%) | 3.473 | 16 | ok |
| trimesh_cylinder.stl | BSD (trimesh) | housing | True | True | True | True 0.95 | 0.0 | 99.0 | 0.3→0.2 (45.0%) | 1.303 | 16 | ok |
| trimesh_empty.stl | BSD (trimesh) | thinwall | True | False | None | None  | - | - | -→- (-%) | 0.0 |  | parse_ok |
| trimesh_featuretype.STL | BSD (trimesh) | bracket | True | True | True | True 2.8 | 602.69 | 0.57 | 0.1→0.1 (42.0%) | 3.313 | 16 | ok |
| trimesh_idler_riser.STL | BSD (trimesh) | bracket | True | True | True | True 4.92 | 4455.98 | 0.3 | 0.0→0.0 (44.8%) | 5.399 | 16 | ok |
| trimesh_large_block.STL | BSD (trimesh) | housing | True | True | True | True 2.37 | 0.0 | 99.0 | 71065710.0→40478149.3 (43.0%) | 2.435 | 16 | ok |
| trimesh_large_block_obb.STL | BSD (trimesh) | housing | True | True | True | True 1.69 | 0.0 | 99.0 | 13341159.5→7444913.1 (44.2%) | 1.753 | 16 | ok |
| trimesh_multibody.stl | BSD (trimesh) | thinwall | True | True | True | False 0.32 | - | - | -→- (-%) | 0.316 |  | voxel_ok |
| trimesh_octagonal_pocket.stl | BSD (trimesh) | thinwall | True | True | True | True 2.2 | 2771663.49 | 0.3 | 0.0→0.0 (44.8%) | 2.647 | 16 | ok |
| trimesh_origin_inside.STL | BSD (trimesh) | thinwall | True | True | True | True 25.53 | 12793.63 | 0.3 | 0.0→0.0 (43.3%) | 25.938 | 16 | ok |
| trimesh_plate_holes.STL | BSD (trimesh) | thinwall | True | True | True | True 2.21 | 0.3 | 99.0 | 21924.8→12382.5 (43.5%) | 2.566 | 16 | ok |
| trimesh_round.stl | BSD (trimesh) | housing | True | True | True | True 0.39 | 2.38 | 99.0 | 36.9→19.0 (48.6%) | 0.471 | 16 | ok |
| trimesh_shared.STL | BSD (trimesh) | thinwall | True | False | True | True 4.46 | 2176.06 | 0.3 | 0.0→0.0 (42.5%) | 4.711 | 16 | ok |
| trimesh_soup.stl | BSD (trimesh) | thinwall | True | False | True | True 26.2 | 9709.88 | 0.3 | 0.0→0.0 (40.5%) | 27.213 | 16 | ok |
| trimesh_teapot.stl | BSD (trimesh) | housing | True | False | True | True 4.39 | 16.73 | 20.62 | 197.6→108.9 (44.9%) | 4.545 | 16 | ok |
| trimesh_torus.STL | BSD (trimesh) | housing | True | True | True | True 5.77 | 3817.4 | 0.3 | 0.0→0.0 (43.8%) | 5.913 | 16 | ok |
| trimesh_two_objects_mixed.stl | BSD (trimesh) | housing | True | True | True | False 0.22 | - | - | -→- (-%) | 0.221 |  | voxel_ok |
| trimesh_unit_cube.STL | BSD (trimesh) | housing | True | True | True | True 22.93 | 15359.83 | 0.3 | 0.0→0.0 (43.5%) | 23.261 | 16 | ok |
| trimesh_unit_sphere.STL | BSD (trimesh) | housing | True | True | True | True 15.65 | 18805.23 | 0.3 | 0.0→0.0 (47.3%) | 15.703 | 16 | ok |
| cow.obj | MIT (common-3d-test-models) | organic | True | True | True | True 10.8 | 8385.3 | 0.3 | 0.3→0.2 (41.9%) | 11.053 | 32 | ok |
| spot.obj | MIT (common-3d-test-models) | organic | True | False | True | True 3.79 | 10093.45 | 0.3 | 0.0→0.0 (42.3%) | 3.888 | 16 | ok |
| stanford-bunny.obj | CC0 (Stanford 3D Scan Repository) | organic | True | False | True | True 10.25 | 4086212.43 | 0.3 | 0.0→0.0 (45.8%) | 10.63 | 16 | ok |
| nefertiti.obj | CC0 (Stanford/Thingi10K) | organic | True | True | True | True 5.66 | 0.74 | 99.0 | 119656.1→68920.2 (42.4%) | 6.078 | 16 | ok |
| armadillo.obj | CC0 (Stanford) | organic | True | True | True | True 3.92 | 0.96 | 99.0 | 3970.0→2245.6 (43.4%) | 4.421 | 16 | ok |
| happy.obj | CC0 (Stanford) | organic | True | False | True | True 3.45 | 681935.59 | 0.3 | 0.0→0.0 (42.2%) | 3.933 | 16 | ok |
| alligator.obj | MIT (common-3d-test-models) | organic | True | False | True | True 0.73 | 0.16 | 99.0 | 32101.4→16749.4 (47.8%) | 0.896 | 32 | ok |
| homer.obj | MIT (common-3d-test-models) | organic | True | True | True | True 2.23 | 69267.79 | 0.3 | 0.0→0.0 (43.8%) | 2.36 | 16 | ok |
| beast.obj | MIT (common-3d-test-models) | organic | True | False | True | True 1.71 | 1.15 | 99.0 | 12506.1→6800.4 (45.6%) | 2.147 | 16 | ok |
| bimba.obj | MIT (common-3d-test-models) | organic | True | True | True | True 7.07 | 225994.24 | 0.3 | 0.0→0.0 (42.4%) | 7.931 | 16 | ok |
| fandisk.obj | MIT (common-3d-test-models) | bracket | True | True | True | True 4.78 | 2365.05 | 0.3 | 0.2→0.1 (43.3%) | 4.905 | 16 | ok |
| rocker-arm.obj | MIT (common-3d-test-models) | bracket | True | True | True | True 1.58 | 24377.52 | 0.3 | 0.0→0.0 (42.8%) | 1.73 | 16 | ok |
| beetle.obj | MIT (common-3d-test-models) | housing | True | False | True | False 0.68 | - | - | -→- (-%) | 0.681 |  | voxel_ok |
| beetle-alt.obj | MIT (common-3d-test-models) | housing | True | False | True | False 0.73 | - | - | -→- (-%) | 0.728 |  | voxel_ok |
| nasa_international_space_station_tools_003_column_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 1.71 | 0.0 | 99.0 | 23.7→13.7 (42.4%) | 1.795 | 16 | ok |
| nasa_international_space_station_tools_006_flexural_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.74 | 82.54 | 4.18 | 52.2→26.6 (49.1%) | 3.615 | 32 | ok |
| nasa_saturn_v_stage_2_joining_cube_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 24.46 | 6.15 | 56.09 | 359.4→203.7 (43.3%) | 24.768 | 16 | ok |
| nasa_saturn_v_rocket_s_ic_joining_cube_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 23.34 | 7.33 | 47.09 | 283.1→160.0 (43.5%) | 23.624 | 16 | ok |
| nasa_explorer_1_03_connector_abs_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 9.09 | 267.62 | 1.29 | 0.4→0.2 (43.4%) | 9.213 | 16 | ok |
| nasa_explorer_1_03_connector_pla_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 12.6 | 266.15 | 1.3 | 0.4→0.2 (43.5%) | 12.72 | 16 | ok |
| nasa_saturn_v_rocket_fin_print_4_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 0.73 | - | - | -→- (-%) | 0.73 |  | voxel_ok |
| nasa_ka_band_satellite_beacon_receiver_alphasat_terminal_sub_reflector_a_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 0.4 | - | - | -→- (-%) | 0.399 |  | voxel_ok |
| nasa_laser_interferometer_space_antenna_lisa_pse_and_battery_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 5.12 | 3632.45 | 0.3 | 25.3→14.7 (42.1%) | 5.33 | 16 | ok |
| nasa_ka_band_satellite_beacon_receiver_alphasat_terminal_sub_reflector_b_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 0.41 | - | - | -→- (-%) | 0.406 |  | voxel_ok |
| nasa_laser_interferometer_space_antenna_lisa_left_side_panel_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 9.08 | 785.59 | 0.44 | 12.1→6.8 (43.9%) | 9.465 | 16 | ok |
| nasa_laser_interferometer_space_antenna_lisa_right_side_panel_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 10.8 | 558.64 | 0.62 | 12.1→6.8 (43.5%) | 11.048 | 16 | ok |
| nasa_international_space_station_tools_019_zerog2_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.75 | 62.25 | 5.54 | 9.5→5.2 (45.1%) | 2.973 | 16 | ok |
| nasa_voyager_instrument_01_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 10.37 | 175.08 | 1.97 | 2.0→1.1 (43.2%) | 10.63 | 16 | ok |
| nasa_voyager_instrument_02_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 10.08 | 195.35 | 1.77 | 2.0→1.1 (43.4%) | 10.341 | 16 | ok |
| nasa_sofia_telescope_cavity_closed_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 14.05 | 145.79 | 2.37 | 26.3→14.7 (44.2%) | 14.342 | 16 | ok |
| nasa_voyager_instrument_03_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.46 | 36.36 | 9.49 | 7.8→4.5 (42.6%) | 2.645 | 16 | ok |
| nasa_laser_interferometer_space_antenna_lisa_combined_bottom_boxes_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 1.17 | 5.48 | 62.95 | 251.1→147.4 (41.3%) | 1.341 | 16 | ok |
| nasa_viking_lander_tool1_b_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.33 | 84.39 | 4.09 | 25.8→13.3 (48.6%) | 2.829 | 32 | ok |
| nasa_ka_band_satellite_beacon_receiver_alphasat_terminal_base_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 1.53 | 11.0 | 31.37 | 93.4→53.1 (43.2%) | 1.679 | 16 | ok |
| nasa_international_space_station_tools_001_ftc_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.62 | 20.38 | 16.93 | 31.4→17.8 (43.2%) | 2.996 | 16 | ok |
| nasa_chandra_x_ray_observatory_chandra_panel_stl.stl | Public Domain (NASA 3D Resources) | housing | True | False | True | False 0.65 | - | - | -→- (-%) | 0.654 |  | voxel_ok |
| nasa_sofia_instrument_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 24.01 | 161.74 | 2.13 | 2.9→1.7 (41.5%) | 24.975 | 16 | ok |
| nasa_chandra_x_ray_observatory_chandra_top_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.02 | 23.17 | 14.89 | 10.9→6.4 (41.9%) | 2.289 | 16 | ok |
| nasa_mars_reconnaissance_orbiter_top_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 0.66 | 1582.18 | 0.3 | 52.7→28.8 (45.4%) | 0.801 | 16 | ok |
| nasa_viking_lander_tool1_a_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.17 | 28.05 | 12.3 | 15.2→8.9 (41.8%) | 2.412 | 16 | ok |
| nasa_international_space_station_tools_004_tensile_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 0.86 | 26.59 | 12.97 | 303.3→162.7 (46.4%) | 0.916 | 16 | ok |
| nasa_mars_reconnaissance_orbiter_antenna_bottom_01_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.25 | 703.67 | 0.49 | 124.5→71.3 (42.7%) | 2.506 | 16 | ok |
| nasa_ka_band_satellite_beacon_receiver_alphasat_terminal_positioner_body_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 13.86 | 239.8 | 1.44 | 8.6→4.8 (44.6%) | 14.49 | 16 | ok |
| nasa_mars_reconnaissance_orbiter_solar_panel_l_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 0.41 | 4.02 | 85.81 | 207.6→112.6 (45.8%) | 0.46 | 16 | ok |
| nasa_mars_reconnaissance_orbiter_solar_panel_r_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 0.5 | 4.05 | 85.13 | 207.6→110.3 (46.9%) | 0.547 | 16 | ok |
| nasa_voyager_stand_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 1.3 | - | - | -→- (-%) | 1.299 |  | voxel_ok |
| nasa_international_space_station_tools_005_compression_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 3.83 | 41.88 | 8.24 | 19.4→11.0 (43.5%) | 4.339 | 16 | ok |
| nasa_hubble_space_telescope_solar_panels_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 0.45 | - | - | -→- (-%) | 0.448 |  | voxel_ok |
| nasa_laser_interferometer_space_antenna_lisa_cmd_and_data_handling_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 19.71 | 403.52 | 0.85 | 5.3→3.0 (44.2%) | 20.352 | 16 | ok |
| nasa_cyclone_global_navigation_satellite_system_cygnss_cyclone_global_navigation.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 0.74 | 220.03 | 1.57 | 0.4→0.2 (42.7%) | 0.839 | 16 | ok |
| nasa_laser_interferometer_space_antenna_lisa_lisa_control_electronics_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 19.45 | 513.35 | 0.67 | 4.6→2.5 (45.0%) | 20.158 | 16 | ok |
| nasa_international_sun_earth_explorer_3_rad_antenna_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 1.67 | - | - | -→- (-%) | 1.666 |  | voxel_ok |
| nasa_hubble_25th_anniversary_model_base_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 7.36 | 1765.5 | 0.3 | 255.3→148.5 (41.8%) | 8.116 | 16 | ok |
| nasa_hubble_space_telescope_base_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 18.78 | 160.05 | 2.16 | 31.6→16.6 (47.5%) | 19.491 | 16 | ok |
| nasa_laser_interferometer_space_antenna_lisa_charge_management_system_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 3.42 | 77.74 | 4.44 | 7.1→4.0 (43.0%) | 3.654 | 16 | ok |
| nasa_galileo_galileo_probe_stl.stl | Public Domain (NASA 3D Resources) | housing | True | False | True | True 8.48 | 31322.11 | 0.3 | 0.0→0.0 (48.3%) | 8.614 | 16 | ok |
| nasa_laser_interferometer_space_antenna_lisa_grs_unit_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 13.78 | 158.47 | 2.18 | 11.6→6.3 (45.7%) | 14.14 | 16 | ok |
| nasa_viking_lander_tool2_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 0.64 | - | - | -→- (-%) | 0.638 |  | voxel_ok |
| nasa_ka_band_satellite_beacon_receiver_alphasat_terminal_positioner_arm_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | False 1.75 | - | - | -→- (-%) | 1.751 |  | voxel_ok |
| nasa_hubble_space_telescope_radio_dishes_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 0.62 | 2178.98 | 0.3 | 15.0→7.8 (47.9%) | 0.703 | 32 | ok |
| nasa_mars_reconnaissance_orbiter_antenna_bottom_02_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 2.66 | 1067.29 | 0.32 | 168.8→99.4 (41.1%) | 3.086 | 16 | ok |
| nasa_viking_lander_dish_part_b_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 1.03 | 299.2 | 1.15 | 11.1→6.3 (43.2%) | 1.432 | 16 | ok |
| nasa_ka_band_satellite_beacon_receiver_alphasat_terminal_antenna_feed_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 15.05 | 1232.25 | 0.3 | 1.4→0.7 (47.3%) | 16.22 | 16 | ok |
| nasa_laser_interferometer_space_antenna_lisa_thruster_stl.stl | Public Domain (NASA 3D Resources) | housing | True | True | True | True 7.04 | 22.29 | 15.48 | 31.4→18.1 (42.3%) | 7.583 | 16 | ok |

**Критерий F2:** solve_ok 86/100 ≥85 — ПРОЙДЕН  
**Инженерных:** 75 ≥25 — ПРОЙДЕН  

Все падения — см. BUG_LIST с воспроизведением, без «готово».

**Build:** см. Release https://github.com/Igorr112323/OpenLight/releases + Build run (≥30МБ, --selftest OK)  