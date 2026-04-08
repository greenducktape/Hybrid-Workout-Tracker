-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "movementPattern" TEXT NOT NULL,
    "primaryMuscles" TEXT NOT NULL,
    "secondaryMuscles" TEXT NOT NULL DEFAULT '[]',
    "equipment" TEXT NOT NULL DEFAULT '[]',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "cues" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayOfWeek" INTEGER NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'BASE',
    "template" TEXT,
    "notes" TEXT,
    "perceivedEffort" INTEGER,
    "durationMinutes" INTEGER,
    "caloriesBurned" INTEGER,
    "heartRateAvg" INTEGER,
    "heartRateMax" INTEGER,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "WorkoutBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "blockType" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "WorkoutBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" REAL,
    "reps" INTEGER,
    "rpe" REAL,
    "durationSeconds" INTEGER,
    "distanceMeters" REAL,
    "calories" INTEGER,
    "isRx" BOOLEAN NOT NULL DEFAULT true,
    "scalingNote" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetLog_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorkoutBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetConResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockId" TEXT NOT NULL,
    "wodName" TEXT,
    "wodType" TEXT NOT NULL,
    "timeCap" INTEGER,
    "roundsCompleted" INTEGER,
    "repsCompleted" INTEGER,
    "completionSeconds" INTEGER,
    "dnf" BOOLEAN NOT NULL DEFAULT false,
    "completedRounds" INTEGER,
    "isRx" BOOLEAN NOT NULL DEFAULT true,
    "scalingNote" TEXT,
    "notes" TEXT,
    CONSTRAINT "MetConResult_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorkoutBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "prType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "weightKg" REAL,
    "isRx" BOOLEAN NOT NULL DEFAULT true,
    "achievedAt" DATETIME NOT NULL,
    "sessionId" TEXT,
    "notes" TEXT,
    CONSTRAINT "PersonalRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phase" TEXT NOT NULL,
    "weeksTotal" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ProgramWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "focus" TEXT,
    "volumePercent" REAL NOT NULL DEFAULT 100,
    CONSTRAINT "ProgramWeek_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "sessionType" TEXT,
    "notes" TEXT,
    CONSTRAINT "ProgramDay_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "ProgramWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "blockType" TEXT NOT NULL,
    "setScheme" TEXT NOT NULL,
    "intensityNote" TEXT,
    "superset" TEXT,
    CONSTRAINT "ProgramExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ProgramDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "goals" TEXT,
    "programId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Competition_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bodyWeightKg" REAL,
    "bodyFatPercent" REAL,
    "heartRateResting" INTEGER,
    "sleepHours" REAL,
    "energyLevel" INTEGER,
    "notes" TEXT,
    "sessionId" TEXT,
    CONSTRAINT "BodyMetric_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MetConResult_blockId_key" ON "MetConResult"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_exerciseId_prType_key" ON "PersonalRecord"("exerciseId", "prType");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_programId_key" ON "Competition"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "BodyMetric_sessionId_key" ON "BodyMetric"("sessionId");
