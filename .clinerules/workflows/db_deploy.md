- 不同的项目的开发分支名字可能不同，可能为preview也可能为dev，自己使用git去确认。

- 比较开发分支和main分支数据库定义。在开发分支，目录/scripts/下生成sql迁移脚本,使得从 main 的数据库结构和开发分支相同。文件名格式为 year_month_day_hour_deploy_to_db.sql
