-- DropForeignKey
ALTER TABLE `Account` DROP FOREIGN KEY `Account_metadataId_fkey`;

-- DropForeignKey
ALTER TABLE `Item` DROP FOREIGN KEY `Item_metadataId_fkey`;

-- DropIndex
DROP INDEX `Account_role_idx` ON `Account`;

-- DropIndex
DROP INDEX `Metadata_deleted_idx` ON `Metadata`;

-- CreateTable
CREATE TABLE `AccountRole` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `role` ENUM('tech_admin', 'general_admin', 'campus_admin', 'tutor', 'student', 'external', 'observer') NOT NULL,

    UNIQUE INDEX `AccountRole_accountId_role_key`(`accountId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Backfill existing roles before dropping the legacy column.
INSERT INTO `AccountRole` (`id`, `accountId`, `role`)
SELECT UUID(), `id`, CASE `role`
    WHEN 'admin' THEN 'tech_admin'
    WHEN 'manager' THEN 'general_admin'
    WHEN 'staff' THEN 'campus_admin'
    WHEN 'viewer' THEN 'observer'
END
FROM `Account`;

-- CreateTable
CREATE TABLE `AccountIdentity` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `provider` ENUM('microsoft', 'google', 'apple') NOT NULL,
    `providerUserId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccountIdentity_accountId_idx`(`accountId`),
    UNIQUE INDEX `AccountIdentity_provider_providerUserId_key`(`provider`, `providerUserId`),
    UNIQUE INDEX `AccountIdentity_accountId_provider_key`(`accountId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campus` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Campus_code_key`(`code`),
    UNIQUE INDEX `Campus_metadataId_key`(`metadataId`),
    INDEX `Campus_name_idx`(`name`),
    INDEX `Campus_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Course_code_key`(`code`),
    UNIQUE INDEX `Course_metadataId_key`(`metadataId`),
    INDEX `Course_name_idx`(`name`),
    INDEX `Course_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `postedById` VARCHAR(191) NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `contents` TEXT NOT NULL,
    `links` JSON NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CourseMaterial_metadataId_key`(`metadataId`),
    INDEX `CourseMaterial_courseId_idx`(`courseId`),
    INDEX `CourseMaterial_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TutorApplication` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `hasScholarship` BOOLEAN NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TutorApplication_metadataId_key`(`metadataId`),
    INDEX `TutorApplication_accountId_idx`(`accountId`),
    INDEX `TutorApplication_status_idx`(`status`),
    INDEX `TutorApplication_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeSlot` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    `startTime` TIME(0) NOT NULL,
    `endTime` TIME(0) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TimeSlot_metadataId_key`(`metadataId`),
    INDEX `TimeSlot_accountId_dayOfWeek_idx`(`accountId`, `dayOfWeek`),
    INDEX `TimeSlot_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `requestedTime` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SessionRequest_metadataId_key`(`metadataId`),
    INDEX `SessionRequest_studentId_idx`(`studentId`),
    INDEX `SessionRequest_courseId_idx`(`courseId`),
    INDEX `SessionRequest_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgrammedSession` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `status` ENUM('scheduled', 'active', 'cancelled', 'finished') NOT NULL DEFAULT 'scheduled',
    `scheduledTime` DATETIME(3) NOT NULL,
    `modality` ENUM('in_person', 'hybrid', 'online') NOT NULL,
    `type` ENUM('one_on_one', 'group') NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `durationInMinutes` INTEGER NOT NULL,
    `maxStudents` INTEGER NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ProgrammedSession_metadataId_key`(`metadataId`),
    INDEX `ProgrammedSession_tutorId_idx`(`tutorId`),
    INDEX `ProgrammedSession_courseId_idx`(`courseId`),
    INDEX `ProgrammedSession_scheduledTime_idx`(`scheduledTime`),
    INDEX `ProgrammedSession_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionRegistration` (
    `sessionId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `attended` BOOLEAN NOT NULL DEFAULT false,
    `feedbackSubmitted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `SessionRegistration_studentId_idx`(`studentId`),
    PRIMARY KEY (`sessionId`, `studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,

    INDEX `SessionFeedback_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionReport` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `report` TEXT NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `metadataId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SessionReport_metadataId_key`(`metadataId`),
    INDEX `SessionReport_sessionId_idx`(`sessionId`),
    INDEX `SessionReport_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_CampusToCourse` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_CampusToCourse_AB_unique`(`A`, `B`),
    INDEX `_CampusToCourse_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TutorApplicationRequestedCourses` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TutorApplicationRequestedCourses_AB_unique`(`A`, `B`),
    INDEX `_TutorApplicationRequestedCourses_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TutorApplicationApprovedCourses` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TutorApplicationApprovedCourses_AB_unique`(`A`, `B`),
    INDEX `_TutorApplicationApprovedCourses_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- AlterTable: Metadata no longer owns soft-delete state.
ALTER TABLE `Metadata` DROP COLUMN `deleted`,
    DROP COLUMN `deletedAt`,
    DROP COLUMN `deletedBy`;

-- AlterTable: history rows now point at the affected entity.
ALTER TABLE `MetadataUpdateHistory`
    ADD COLUMN `entityId` VARCHAR(191) NULL,
    ADD COLUMN `entityType` ENUM('account', 'campus', 'course', 'course_material', 'tutor_application', 'time_slot', 'session_request', 'programmed_session', 'session_report') NULL;

UPDATE `MetadataUpdateHistory` `h`
LEFT JOIN `Metadata` `m` ON `m`.`id` = `h`.`metadataId`
LEFT JOIN `Account` `a` ON `a`.`metadataId` = `m`.`id`
SET `h`.`entityType` = 'account',
    `h`.`entityId` = COALESCE(`a`.`id`, `h`.`metadataId`);

ALTER TABLE `MetadataUpdateHistory`
    MODIFY `entityId` VARCHAR(191) NOT NULL,
    MODIFY `entityType` ENUM('account', 'campus', 'course', 'course_material', 'tutor_application', 'time_slot', 'session_request', 'programmed_session', 'session_report') NOT NULL;

-- Ensure every legacy account has Metadata before metadataId becomes required.
SET @orphan_metadata_id = UUID();
INSERT INTO `Metadata` (`id`, `createdAt`, `updatedAt`)
SELECT @orphan_metadata_id, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE EXISTS (SELECT 1 FROM `Account` WHERE `metadataId` IS NULL);
UPDATE `Account` SET `metadataId` = @orphan_metadata_id WHERE `metadataId` IS NULL;

-- AlterTable: identity columns, soft delete and nullable password.
ALTER TABLE `Account`
    ADD COLUMN `campusId` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` VARCHAR(191) NULL,
    ADD COLUMN `idType` ENUM('account_number', 'employee_id', 'national_id', 'passport') NULL,
    ADD COLUMN `identifier` VARCHAR(191) NULL,
    MODIFY `password` VARCHAR(191) NULL,
    MODIFY `status` ENUM('active', 'locked', 'banned', 'inactive') NOT NULL DEFAULT 'active',
    MODIFY `metadataId` VARCHAR(191) NOT NULL;

UPDATE `Account`
SET `idType` = COALESCE(`idType`, 'account_number'),
    `identifier` = COALESCE(`identifier`, CONCAT('legacy:', `id`));

ALTER TABLE `Account`
    MODIFY `idType` ENUM('account_number', 'employee_id', 'national_id', 'passport') NOT NULL,
    MODIFY `identifier` VARCHAR(191) NOT NULL,
    DROP COLUMN `role`;

-- DropTable
DROP TABLE `Item`;

-- CreateIndex
CREATE INDEX `Account_campusId_idx` ON `Account`(`campusId`);

-- CreateIndex
CREATE INDEX `Account_deletedAt_idx` ON `Account`(`deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Account_idType_identifier_key` ON `Account`(`idType`, `identifier`);

-- CreateIndex
CREATE INDEX `MetadataUpdateHistory_entityType_entityId_idx` ON `MetadataUpdateHistory`(`entityType`, `entityId`);

-- AddForeignKey
ALTER TABLE `AccountRole` ADD CONSTRAINT `AccountRole_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountIdentity` ADD CONSTRAINT `AccountIdentity_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campus` ADD CONSTRAINT `Campus_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseMaterial` ADD CONSTRAINT `CourseMaterial_postedById_fkey` FOREIGN KEY (`postedById`) REFERENCES `Account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseMaterial` ADD CONSTRAINT `CourseMaterial_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseMaterial` ADD CONSTRAINT `CourseMaterial_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorApplication` ADD CONSTRAINT `TutorApplication_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorApplication` ADD CONSTRAINT `TutorApplication_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeSlot` ADD CONSTRAINT `TimeSlot_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeSlot` ADD CONSTRAINT `TimeSlot_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionRequest` ADD CONSTRAINT `SessionRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionRequest` ADD CONSTRAINT `SessionRequest_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionRequest` ADD CONSTRAINT `SessionRequest_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammedSession` ADD CONSTRAINT `ProgrammedSession_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammedSession` ADD CONSTRAINT `ProgrammedSession_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammedSession` ADD CONSTRAINT `ProgrammedSession_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionRegistration` ADD CONSTRAINT `SessionRegistration_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ProgrammedSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionRegistration` ADD CONSTRAINT `SessionRegistration_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionFeedback` ADD CONSTRAINT `SessionFeedback_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ProgrammedSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionReport` ADD CONSTRAINT `SessionReport_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ProgrammedSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionReport` ADD CONSTRAINT `SessionReport_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionReport` ADD CONSTRAINT `SessionReport_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CampusToCourse` ADD CONSTRAINT `_CampusToCourse_A_fkey` FOREIGN KEY (`A`) REFERENCES `Campus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CampusToCourse` ADD CONSTRAINT `_CampusToCourse_B_fkey` FOREIGN KEY (`B`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TutorApplicationRequestedCourses` ADD CONSTRAINT `_TutorApplicationRequestedCourses_A_fkey` FOREIGN KEY (`A`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TutorApplicationRequestedCourses` ADD CONSTRAINT `_TutorApplicationRequestedCourses_B_fkey` FOREIGN KEY (`B`) REFERENCES `TutorApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TutorApplicationApprovedCourses` ADD CONSTRAINT `_TutorApplicationApprovedCourses_A_fkey` FOREIGN KEY (`A`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TutorApplicationApprovedCourses` ADD CONSTRAINT `_TutorApplicationApprovedCourses_B_fkey` FOREIGN KEY (`B`) REFERENCES `TutorApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

