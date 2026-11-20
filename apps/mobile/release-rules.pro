# Room 2.5 instantiates this WorkManager database by reflection during process startup.
-keep class androidx.work.impl.WorkDatabase_Impl { public <init>(); }
